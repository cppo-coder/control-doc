#!/usr/bin/env node

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const port = Number.parseInt(process.env.NOTEBOOKLM_RENEWAL_PORT ?? '4318', 10);
const token = process.env.NOTEBOOKLM_RENEWAL_TOKEN ?? '';
const defaultBrowser = process.env.NOTEBOOKLM_RENEWAL_BROWSER ?? 'chrome';
const profileDir = process.env.NOTEBOOKLM_RENEWAL_PROFILE
    ?? path.join(os.homedir(), '.notebooklm-playwright-profile');

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
}

function buildCookieHeader(cookies) {
    return cookies
        .filter(cookie => cookie.name && cookie.value)
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

async function captureSession(timeoutSeconds, browser) {
    const timeout = Math.max(20, timeoutSeconds) * 1000;
    const channel = browser === 'edge' ? 'msedge' : 'chrome';
    const context = await chromium.launchPersistentContext(profileDir, {
        channel,
        headless: false,
    });

    try {
        const page = context.pages()[0] ?? await context.newPage();

        await page.goto('https://notebooklm.google.com/', {
            waitUntil: 'domcontentloaded',
            timeout,
        });

        const request = await page.waitForRequest(
            candidate => candidate.url().includes('/_/LabsTailwindUi/data/batchexecute'),
            { timeout }
        );

        const cookies = await context.cookies([
            'https://notebooklm.google.com',
            'https://accounts.google.com',
            'https://google.com',
        ]);

        const cookieHeader = buildCookieHeader(cookies);

        if (! cookieHeader) {
            throw new Error('No se pudieron leer cookies del contexto de navegador.');
        }

        return {
            success: true,
            browser,
            captured_at: new Date().toISOString(),
            request_url: request.url(),
            request_body: request.postData() ?? '',
            cookie_header: cookieHeader,
        };
    } finally {
        await context.close();
    }
}

const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/capture') {
        return sendJson(response, 404, { success: false, error: 'Ruta no encontrada.' });
    }

    if (token !== '') {
        const authHeader = request.headers.authorization ?? '';
        if (authHeader !== `Bearer ${token}`) {
            return sendJson(response, 401, { success: false, error: 'Token invalido.' });
        }
    }

    const chunks = [];

    request.on('data', chunk => chunks.push(chunk));
    request.on('end', async () => {
        try {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            const payload = rawBody.trim() === '' ? {} : JSON.parse(rawBody);
            const timeoutSeconds = Number.parseInt(payload.timeout_seconds ?? '90', 10);
            const browser = String(payload.browser ?? defaultBrowser).toLowerCase();
            const result = await captureSession(timeoutSeconds, browser);

            sendJson(response, 200, result);
        } catch (error) {
            sendJson(response, 500, {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido durante la captura.',
            });
        }
    });
});

server.listen(port, '127.0.0.1', () => {
    console.log(`NotebookLM renewal worker escuchando en http://127.0.0.1:${port}/capture`);
    console.log(`Perfil persistente: ${profileDir}`);
});
