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

        const tasks = params.tasks;
        const silent = params.silent || false;
        const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url
            || process.env.CLAWFORCE_BACKEND_URL
            || 'https://dev-backend-clawforce.altovation.in';

        const taskId = env.OPENCLAW_TASK_ID || process.env.OPENCLAW_TASK_ID;
        const collectionName = env.COLLECTION_NAME || process.env.COLLECTION_NAME;
        const missionId = env.OPENCLAW_MISSION_ID || process.env.OPENCLAW_MISSION_ID || params.missionId;

        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            console.log(JSON.stringify({ status: "error", message: "No tasks provided." }));
            process.exit(1);
        }

        if (!missionId) {
            console.log(JSON.stringify({ status: "error", message: "Missing missionId." }));
            process.exit(1);
        }

        if (taskId) {
            console.error(`[post-tasks] PRIMARY: calling /api/missions/post-tasks-by-task`);
            const result = await postJson(backendUrl, '/api/missions/post-tasks-by-task', {
                taskId,
                collectionName,
                missionId,
                tasks,
                silent
            });

            if (result.statusCode === 200 || result.statusCode === 201) {
                const responseJson = JSON.parse(result.body);
                console.log(JSON.stringify({
                    status: "success",
                    message: `Successfully spawned ${tasks.length} platform deployment tasks via task-based endpoint.`,
                    taskIds: responseJson.ids || []
                }));
                process.exit(0);
            } else {
                console.error(`[post-tasks] Primary path failed (${result.statusCode}): ${result.body}`);
            }
        }

        // Fallback
        const userId = env.USER_ID;
        const token = env.TOKEN;

        if (!userId || !token) {
            console.log(JSON.stringify({
                status: "error",
                message: "No taskId and no userId/token in context. Authentication failed."
            }));
            process.exit(1);
        }

        console.error(`[post-tasks] FALLBACK: calling /api/missions/post-tasks`);
        const fallbackResult = await postJson(backendUrl, '/api/missions/post-tasks', {
            userId,
            token,
            missionId,
            tasks,
            silent
        });

        if (fallbackResult.statusCode === 200 || fallbackResult.statusCode === 201) {
            const responseJson = JSON.parse(fallbackResult.body);
            console.log(JSON.stringify({
                status: "success",
                message: `Successfully spawned ${tasks.length} tasks via fallback endpoint.`,
                taskIds: responseJson.ids || []
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
