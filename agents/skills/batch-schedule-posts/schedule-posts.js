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
    
    // 2.1 Add LinkedIn Pages
    const rawPages = getEnv('LINKEDIN_PAGE_URN');
    if (rawPages) {
        try {
            const pages = JSON.parse(rawPages);
            if (Array.isArray(pages)) allTargets.push(...pages);
        } catch (e) {
            if (rawPages.includes('urn:li:')) {
                allTargets.push({ urn: rawPages, name: 'Target Page', pic: null });
            }
        }
    }
    
    // 2.2 Add LinkedIn Personal Info
    const personalKeys = ['LINKEDIN_PERSONAL_INFO', 'LINKEDIN_PERSONAL_URN'];
    for (const key of personalKeys) {
        const val = getEnv(key);
        if (val && val.startsWith('[')) {
            try {
                const personal = JSON.parse(val);
                if (Array.isArray(personal)) {
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

    // 2.3 Add Facebook Pages & Personal
    const fbPagesRaw = getEnv('FACEBOOK_PAGE_LIST');
    if (fbPagesRaw) {
        try {
            const fbPages = JSON.parse(fbPagesRaw);
            if (Array.isArray(fbPages)) {
                fbPages.forEach(page => {
                    allTargets.push({ urn: page.id, name: page.name, pic: page.pic });
                });
            }
        } catch(e) {}
    }
    const fbPersonalRaw = getEnv('FACEBOOK_PERSONAL_INFO');
    if (fbPersonalRaw) {
        try {
            const fbPersonal = JSON.parse(fbPersonalRaw);
            if (Array.isArray(fbPersonal)) {
                fbPersonal.forEach(p => {
                    if (!allTargets.find(t => t.urn === p.id)) {
                        allTargets.push({ urn: p.id, name: p.name, pic: p.pic });
                    }
                });
            }
        } catch(e) {}
    }

    // 2.4 Add Instagram Accounts & Personal
    const igAccountsRaw = getEnv('INSTAGRAM_PAGE_LIST');
    if (igAccountsRaw) {
        try {
            const igAccounts = JSON.parse(igAccountsRaw);
            if (Array.isArray(igAccounts)) {
                igAccounts.forEach(ig => {
                    allTargets.push({ urn: ig.id, name: ig.username || ig.name, pic: ig.pic });
                });
            }
        } catch(e) {}
    }
    const igPersonalRaw = getEnv('INSTAGRAM_PERSONAL_INFO');
    if (igPersonalRaw) {
        try {
            const igPersonal = JSON.parse(igPersonalRaw);
            if (Array.isArray(igPersonal)) {
                igPersonal.forEach(p => {
                    if (!allTargets.find(t => t.urn === p.id)) {
                        allTargets.push({ urn: p.id, name: p.name, pic: p.pic });
                    }
                });
            }
        } catch(e) {}
    }

    let defaultTarget = { urn: null, name: null, pic: null };
    if (allTargets.length > 0) {
        defaultTarget = { 
            urn: allTargets[0].urn, 
            name: allTargets[0].name, 
            pic: allTargets[0].pic 
        };
    }

    let agentId = 'linkedin-manager';
    if (getEnv('FACEBOOK_PAGE_LIST')) agentId = 'facebook-manager';
    else if (getEnv('INSTAGRAM_PAGE_LIST')) agentId = 'instagram-manager';

    if (!defaultTarget.urn) {
        console.warn(`[Schedule] Warning: No platform accounts found in environment.`);
    }

    const payloadObj = {
        userId,
        token,
        posts: posts.map(p => {
            // Determine target for this specific post
            let targetUrn = p.targetUrn || defaultTarget.urn;
            let targetName = p.targetName || defaultTarget.name;
            let targetPic = p.targetPic || defaultTarget.pic;

            // Match from overall aggregated targets
            if (p.targetName) {
                 const match = allTargets.find(t => t.name && t.name.toLowerCase().includes(p.targetName.toLowerCase()));
                 if (match) {
                     targetUrn = match.urn;
                     targetName = match.name;
                     targetPic = match.pic;
                 }
            }

            const scheduledAt = p.scheduledAt || p.scheduledFor;

            return {
                ...p,
                agentId,
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
