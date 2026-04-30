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
    // Fallback to stdin
    try {
        rawInput = fs.readFileSync(0, 'utf8');
    } catch (e) {
        // If stdin is not available/empty
    }
}

if (!rawInput || !rawInput.trim()) {
    console.log(JSON.stringify({ status: "error", message: "No input received from OpenClaw via argument, file, or stdin." }));
    process.exit(1);
}

try {
    const data = JSON.parse(rawInput);
    const params = data.params || {};
    const env = data.context?.env || {};

    const tasks = params.tasks;
    const isSilent = params.silent || false;
    const missionId = env.OPENCLAW_MISSION_ID || process.env.OPENCLAW_MISSION_ID;
    const userId = env.USER_ID || process.env.USER_ID;
    const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url || process.env.CLAWFORCE_BACKEND_URL;
    const token = env.TOKEN || process.env.TOKEN;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        console.log(JSON.stringify({ status: "error", message: "No tasks provided." }));
        process.exit(1);
    }

    if (!missionId) {
        console.log(JSON.stringify({ status: "error", message: "Missing OPENCLAW_MISSION_ID in context." }));
        process.exit(1);
    }

    if (!userId) {
        console.log(JSON.stringify({ status: "error", message: "Missing USER_ID in context." }));
        process.exit(1);
    }

    if (!backendUrl || !token) {
        console.log(JSON.stringify({ status: "error", message: "Missing CLAWFORCE_BACKEND_URL or review TOKEN in context." }));
        process.exit(1);
    }

    // 2. Prepare Payload for Backend
    const payload = JSON.stringify({
        missionId,
        userId,
        token,
        tasks,
        silent: isSilent
    });

    const url = new URL(`${backendUrl.replace(/\/$/, '')}/api/missions/post-tasks`);
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = protocol.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
                try {
                    const responseJson = JSON.parse(body);
                    console.log(JSON.stringify({
                        status: "success",
                        message: `Successfully spawned ${tasks.length} platform deployment tasks via Backend.`,
                        taskIds: responseJson.ids || []
                    }));
                } catch (e) {
                    console.log(JSON.stringify({
                        status: "success",
                        message: `Successfully spawned ${tasks.length} platform deployment tasks via Backend.`
                    }));
                }
            } else {
                console.log(JSON.stringify({
                    status: "error",
                    message: `Backend API returned ${res.statusCode}: ${body}`
                }));
                process.exit(1);
            }
        });
    });

    req.on('error', (e) => {
        console.log(JSON.stringify({ status: "error", message: e.message }));
        process.exit(1);
    });
    req.write(payload);
    req.end();

} catch (err) {
    console.log(JSON.stringify({ status: "error", message: "Failed to process request: " + err.message }));
    process.exit(1);
}
