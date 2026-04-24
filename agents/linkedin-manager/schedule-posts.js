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
    const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url || process.env.CLAWFORCE_BACKEND_URL;
    const userId = env.USER_ID || process.env.USER_ID;
    const token = env.TOKEN || process.env.TOKEN;

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
    // Collect all possible targets (Pages and Personal Accounts)
    let allTargets = [];
    const getEnv = (key) => env[key] || process.env[key] || env[key.toLowerCase()] || process.env[key.toLowerCase()];
    
    // Add Pages
    const rawPages = getEnv('LINKEDIN_PAGE_URN');
    if (rawPages) {
        try {
            const pages = JSON.parse(rawPages);
            if (Array.isArray(pages)) allTargets.push(...pages);
        } catch (e) {
            // If it's a raw URN string, create a minimal target object
            if (rawPages.includes('urn:li:')) {
                allTargets.push({ urn: rawPages, name: 'Target Page', pic: null });
            }
        }
    }
    
    // Add Personal Account Info (check multiple possible keys)
    const personalKeys = ['LINKEDIN_PERSONAL_INFO', 'LINKEDIN_PERSONAL_URN'];
    for (const key of personalKeys) {
        const val = getEnv(key);
        if (val && val.startsWith('[')) {
            try {
                const personal = JSON.parse(val);
                if (Array.isArray(personal)) {
                    // Avoid duplicates
                    personal.forEach(p => {
                        if (!allTargets.find(t => t.urn === p.urn)) allTargets.push(p);
                    });
                }
            } catch (e) {}
        } else if (val && val.includes('urn:li:person:')) {
             if (!allTargets.find(t => t.urn === val)) {
                allTargets.push({ urn: val, name: 'Personal Account', pic: null });
             }
        }
    }

    let defaultTarget = { urn: null, name: null, pic: null };
    if (allTargets.length > 0) {
        defaultTarget = { 
            urn: allTargets[0].urn, 
            name: allTargets[0].name, 
            pic: allTargets[0].pic 
        };
    }

    if (!defaultTarget.urn) {
        console.warn(`[Schedule] Warning: No LinkedIn accounts found in environment.`);
    }

    const payloadObj = {
        userId,
        token,
        posts: posts.map(p => {
            // Determine target for this specific post
            let targetUrn = p.targetUrn || defaultTarget.urn;
            let targetName = p.targetName || defaultTarget.name;
            let targetPic = p.targetPic || defaultTarget.pic;

            // If the agent passed a specific target name, try to match it
            if (p.targetName && env.LINKEDIN_PAGE_URN) {
                 try {
                     const pages = JSON.parse(env.LINKEDIN_PAGE_URN);
                     const match = pages.find(page => page.name.toLowerCase().includes(p.targetName.toLowerCase()));
                     if (match) {
                         targetUrn = match.urn;
                         targetName = match.name;
                         targetPic = match.pic;
                     }
                 } catch (e) {}
            }

            // Map both scheduledAt and scheduledFor to scheduledAt
            const scheduledAt = p.scheduledAt || p.scheduledFor;

            return {
                ...p,
                agentId: 'linkedin-manager',
                scheduledAt,
                targetUrn,
                targetName,
                targetPic
            };
        })
    };

    const payload = JSON.stringify(payloadObj);

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
