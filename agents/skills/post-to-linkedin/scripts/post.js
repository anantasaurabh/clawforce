import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// 1. Read input from OpenClaw (Flexible: Arg > File > Stdin)
let rawInput = '';
if (process.argv[2]) {
    const arg = process.argv[2];
    if (fs.existsSync(arg)) {
        rawInput = fs.readFileSync(arg, 'utf8');
    } else {
        rawInput = arg;
    }
} else {
    try {
        rawInput = fs.readFileSync(0, 'utf8');
    } catch (e) {}
}

if (!rawInput || !rawInput.trim()) {
    console.log(JSON.stringify({ status: "error", message: "No input received." }));
    process.exit(1);
}

function postJson(backendUrl, path, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const url = new URL(`${backendUrl.replace(/\/$/, '')}${path}`);
        const protocol = url.protocol === 'https:' ? https : http;
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', (d) => data += d);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    try {
        const data = JSON.parse(rawInput);
        const params = data.params || {};
        const env = data.context?.env || {};

        const target = params.target || 'personal';
        const content = params.content;
        const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url
            || process.env.CLAWFORCE_BACKEND_URL
            || 'https://dev-backend-clawforce.altovation.in';

        const taskId = env.OPENCLAW_TASK_ID || process.env.OPENCLAW_TASK_ID;
        const collectionName = env.COLLECTION_NAME || process.env.COLLECTION_NAME;

        if (!content) {
            console.log(JSON.stringify({ status: "error", message: "No content provided." }));
            process.exit(1);
        }

        if (taskId) {
            console.error(`[post-linkedin] PRIMARY: calling /api/linkedin/post-by-task`);
            const result = await postJson(backendUrl, '/api/linkedin/post-by-task', {
                taskId,
                collectionName,
                target,
                content
            });

            if (result.statusCode === 200 || result.statusCode === 201) {
                const responseJson = JSON.parse(result.body);
                console.log(JSON.stringify({
                    status: "success",
                    message: `Successfully posted to LinkedIn ${target} via task-based endpoint.`,
                    link: responseJson.link
                }));
                process.exit(0);
            } else {
                console.error(`[post-linkedin] Primary path failed (${result.statusCode}): ${result.body}`);
            }
        }

        console.log(JSON.stringify({ 
            status: "error", 
            message: "Authentication failed. Task ID is missing and legacy direct posting is disabled for security." 
        }));
        process.exit(1);

    } catch (err) {
        console.log(JSON.stringify({ status: "error", message: "Failed to process request: " + err.message }));
        process.exit(1);
    }
})();
