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

// Helper: POST JSON to backend, returns { statusCode, body }
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

// Wrap in async IIFE — compatible with ESM module without top-level await issues
(async () => {
    try {
        const data = JSON.parse(rawInput);
        const params = data.params || {};
        const env = data.context?.env || {};

        const icp = params.icp;
        const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url
            || process.env.CLAWFORCE_BACKEND_URL
            || 'https://dev-backend-clawforce.altovation.in';

        // --- Credential Resolution ---
        // OPENCLAW_TASK_ID and COLLECTION_NAME are injected per-task by the runner.
        // These are NOT in OpenClaw's own .env (they're task-specific), so they survive
        // the .env clobbering that corrupts USER_ID and TOKEN on the remote VPS.
        const taskId = env.OPENCLAW_TASK_ID || process.env.OPENCLAW_TASK_ID;
        const collectionName = env.COLLECTION_NAME || process.env.COLLECTION_NAME;

        // USER_ID and TOKEN from STDIN context only — no process.env fallback to avoid
        // picking up stale credentials from OpenClaw's own .env on the remote VPS.
        const userId = env.USER_ID;
        const token = env.TOKEN;

        console.error(`[post-icp] backendUrl: ${backendUrl}`);
        console.error(`[post-icp] taskId: ${taskId || 'MISSING'}`);
        console.error(`[post-icp] collectionName: ${collectionName || 'MISSING (will use default)'}`);
        console.error(`[post-icp] userId (STDIN only): ${userId || 'MISSING'}`);
        console.error(`[post-icp] token (STDIN only): ${token ? 'PRESENT (len:' + token.length + ')' : 'MISSING'}`);

        if (!icp) {
            console.log(JSON.stringify({ status: "error", message: "No ICP provided." }));
            process.exit(1);
        }

        // === PRIMARY PATH: Task-ID-based endpoint ===
        // Backend looks up the task in Firestore to get the authoritative ownerId.
        // No token needed — taskId is the auth (random, unguessable Firestore doc ID).
        if (taskId) {
            console.error(`[post-icp] PRIMARY: calling /api/user/update-icp-by-task`);
            try {
                const result = await postJson(backendUrl, '/api/user/update-icp-by-task', {
                    taskId,
                    collectionName,
                    icp
                });

                if (result.statusCode === 200 || result.statusCode === 201) {
                    console.log(JSON.stringify({
                        status: "success",
                        message: "ICP updated successfully via task-based endpoint."
                    }));
                    process.exit(0);
                } else {
                    console.error(`[post-icp] Primary path failed (${result.statusCode}): ${result.body}. Trying fallback...`);
                }
            } catch (primaryErr) {
                console.error(`[post-icp] Primary path error: ${primaryErr.message}. Trying fallback...`);
            }
        } else {
            console.error(`[post-icp] No taskId — skipping primary path.`);
        }

        // === FALLBACK PATH: Token-based endpoint ===
        // Only used if taskId is unavailable AND STDIN context has valid credentials.
        if (!userId || !token) {
            console.log(JSON.stringify({
                status: "error",
                message: `Primary path unavailable and fallback unavailable (no userId/token in STDIN context). ` +
                         `Ensure the runner injects OPENCLAW_TASK_ID into the agent environment.`
            }));
            process.exit(1);
        }

        console.error(`[post-icp] FALLBACK: calling /api/user/update-config (userId: ${userId})`);
        const fallbackResult = await postJson(backendUrl, '/api/user/update-config', {
            userId,
            token,
            updates: { icp }
        });

        if (fallbackResult.statusCode === 200 || fallbackResult.statusCode === 201) {
            console.log(JSON.stringify({
                status: "success",
                message: "ICP updated successfully via fallback token endpoint."
            }));
        } else {
            console.log(JSON.stringify({
                status: "error",
                message: `Fallback backend API returned ${fallbackResult.statusCode}: ${fallbackResult.body}`
            }));
            process.exit(1);
        }

    } catch (err) {
        console.log(JSON.stringify({ status: "error", message: "Failed to process request: " + err.message }));
        process.exit(1);
    }
})();
