import fs from 'fs';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// 1. Read input from OpenClaw (JSON over Stdin)
const rawInput = fs.readFileSync(0, 'utf8');

if (!rawInput) {
    sendError("No input received from OpenClaw.");
}

try {
    const data = JSON.parse(rawInput);
    const params = data.params || {};
    const env = data.context?.env || {};

    const posts = params.posts;
    const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url;
    const userId = env.USER_ID;
    const token = env.TOKEN;

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
        sendError("No posts provided for batch scheduling.");
    }

    if (!backendUrl) {
        sendError("Missing CLAWFORCE_BACKEND_URL in environment.");
    }

    if (!userId || !token) {
        sendError("Missing USER_ID or TOKEN for backend authentication.");
    }

    // 2. Prepare Payload for Backend
    const payload = JSON.stringify({
        userId,
        token,
        posts: posts.map(p => ({
            ...p,
            agentId: 'linkedin-manager' // Hardcoded for this agent
        }))
    });

    // 3. Parse Backend URL
    const url = new URL(`${backendUrl.replace(/\/$/, '')}/api/posts/batch-create`);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
                const response = JSON.parse(body);
                console.log(JSON.stringify({
                    status: "success",
                    message: `Successfully scheduled ${posts.length} posts via backend.`,
                    count: response.count,
                    ids: response.ids
                }));
            } else {
                sendError(`Backend API returned ${res.statusCode}: ${body}`, res.statusCode.toString());
            }
        });
    });

    req.on('error', (e) => sendError(e.message));
    req.write(payload);
    req.end();

} catch (err) {
    sendError("Failed to process request: " + err.message);
}

function sendError(message, code = "INTERNAL_ERROR") {
    console.log(JSON.stringify({ status: "error", error_code: code, message: message }));
    process.exit(1);
}
