#!/usr/bin/env node

import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import process from 'node:process';

function parseArgs(argv) {
    const args = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }

        const key = token.slice(2);
        const value = argv[index + 1] && !argv[index + 1].startsWith('--')
            ? argv[++index]
            : 'true';

        args[key] = value;
    }

    return args;
}

function resolveBrowserPath(browser) {
    const platform = process.platform;
    const candidates = browser === 'chrome'
        ? {
            darwin: [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
            ],
            win32: [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            ],
            linux: [
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
            ],
        }
        : {
            darwin: [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                path.join(os.homedir(), 'Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'),
            ],
            win32: [
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            ],
            linux: [
                '/usr/bin/microsoft-edge',
                '/usr/bin/microsoft-edge-stable',
            ],
        };

    return (candidates[platform] ?? []).find(candidate => syncFs.existsSync(candidate));
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} al consultar ${url}`);
    }

    return response.json();
}

async function waitForDebugger(port, timeoutMs) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        try {
            return await fetchJson(`http://127.0.0.1:${port}/json/version`);
        } catch {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new Error('No fue posible conectar con el puerto de depuracion remota del navegador.');
}

function launchBrowser(executablePath, browser, port, profilePath) {
    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profilePath}`,
        '--new-window',
        'https://notebooklm.google.com/',
    ];

    const child = spawn(executablePath, args, {
        detached: true,
        stdio: 'ignore',
    });

    child.unref();

    console.log(`[capture] ${browser} abierto con depuracion remota en el puerto ${port}.`);
}

function createRpc(socket) {
    let nextId = 1;
    const pending = new Map();

    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);

        if (typeof message.id === 'number' && pending.has(message.id)) {
            const { resolve, reject } = pending.get(message.id);
            pending.delete(message.id);

            if (message.error) {
                reject(new Error(message.error.message ?? 'CDP error'));
            } else {
                resolve(message.result ?? {});
            }
        }
    });

    return function send(method, params = {}, sessionId = null) {
        const id = nextId++;
        const payload = { id, method, params };

        if (sessionId) {
            payload.sessionId = sessionId;
        }

        socket.send(JSON.stringify(payload));

        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
        });
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const browser = (args.browser ?? 'edge').toLowerCase();
    const port = Number.parseInt(args.port ?? '9222', 10);
    const timeoutSeconds = Number.parseInt(args.timeout ?? '180', 10);
    const timeoutMs = timeoutSeconds * 1000;
    const profilePath = args.profile ?? path.join(process.cwd(), 'storage/app/notebooklm-browser-profile');
    const outputPath = args.output ?? path.join(process.cwd(), 'storage/app/notebooklm-runtime/captured-session.json');
    const executablePath = resolveBrowserPath(browser);

    if (!executablePath) {
        throw new Error(`No se encontro un ejecutable para ${browser}.`);
    }

    await fs.mkdir(profilePath, { recursive: true });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    launchBrowser(executablePath, browser, port, profilePath);

    console.log('[capture] Esperando que NotebookLM cargue. Inicia sesion y abre cualquier cuaderno.');

    const version = await waitForDebugger(port, timeoutMs);
    const socket = new WebSocket(version.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });

    const send = createRpc(socket);
    const requests = new Map();
    const attachedSessions = new Set();

    const finalizeCapture = async capture => {
        await fs.writeFile(outputPath, JSON.stringify(capture, null, 2));
        console.log(`[capture] Sesion capturada en ${outputPath}`);
        socket.close();
        process.exit(0);
    };

    const trackRequest = async (sessionId, requestId, patch) => {
        const key = `${sessionId}:${requestId}`;
        const current = requests.get(key) ?? {};
        const next = { ...current, ...patch };
        requests.set(key, next);

        if (next.request_url && next.request_body && next.cookie_header) {
            await finalizeCapture({
                captured_at: new Date().toISOString(),
                browser,
                request_url: next.request_url,
                request_body: next.request_body,
                cookie_header: next.cookie_header,
            });
        }
    };

    const attachToTarget = async targetId => {
        try {
            const { sessionId } = await send('Target.attachToTarget', {
                targetId,
                flatten: true,
            });

            if (attachedSessions.has(sessionId)) {
                return;
            }

            attachedSessions.add(sessionId);
            await send('Network.enable', {}, sessionId);
            await send('Page.enable', {}, sessionId);
        } catch {
            // Algunos targets internos no aceptan attach; se ignoran.
        }
    };

    socket.addEventListener('message', async event => {
        const message = JSON.parse(event.data);

        if (message.method === 'Target.attachedToTarget') {
            const sessionId = message.params?.sessionId;
            if (sessionId && !attachedSessions.has(sessionId)) {
                attachedSessions.add(sessionId);
                await send('Network.enable', {}, sessionId).catch(() => {});
                await send('Page.enable', {}, sessionId).catch(() => {});
            }

            return;
        }

        const sessionId = message.sessionId;
        if (!sessionId || !message.method?.startsWith('Network.')) {
            return;
        }

        if (message.method === 'Network.requestWillBeSent') {
            const url = message.params?.request?.url;
            if (!url || !url.includes('/_/LabsTailwindUi/data/batchexecute')) {
                return;
            }

            const requestId = message.params.requestId;
            let requestBody = message.params?.request?.postData ?? null;

            if (!requestBody) {
                try {
                    const postData = await send('Network.getRequestPostData', { requestId }, sessionId);
                    requestBody = postData.postData ?? null;
                } catch {
                    requestBody = null;
                }
            }

            await trackRequest(sessionId, requestId, {
                request_url: url,
                request_body: requestBody,
            });

            return;
        }

        if (message.method === 'Network.requestWillBeSentExtraInfo') {
            const requestId = message.params.requestId;
            const cookieHeader = message.params?.headers?.cookie ?? message.params?.headers?.Cookie ?? null;

            if (!cookieHeader) {
                return;
            }

            await trackRequest(sessionId, requestId, {
                cookie_header: cookieHeader,
            });
        }
    });

    await send('Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
    });

    const targets = await send('Target.getTargets');
    for (const target of targets.targetInfos ?? []) {
        if (target.type === 'page') {
            await attachToTarget(target.targetId);
        }
    }

    const timeoutHandle = setTimeout(() => {
        console.error('[capture] Tiempo agotado sin capturar un request valido de NotebookLM.');
        socket.close();
        process.exit(1);
    }, timeoutMs);

    socket.addEventListener('close', () => clearTimeout(timeoutHandle));
}

main().catch(error => {
    console.error(`[capture] ${error.message}`);
    process.exit(1);
});
