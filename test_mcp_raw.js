import { spawn } from 'child_process';

const child = spawn('npx', ['-y', 'notebooklm-mcp', 'stdio']);

child.stdout.on('data', (data) => process.stdout.write(data));
child.stderr.on('data', (data) => process.stderr.write(data));

// Enviar el request JSON-RPC 2.0 por stdin
const request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "mcp_notebooklm_notebook_list",
        "arguments": {"max_results": 10}
    }
};

setTimeout(() => {
    child.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

setTimeout(() => {
    child.kill();
}, 5000);
