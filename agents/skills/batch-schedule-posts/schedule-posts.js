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

        const posts = params.posts;
        const backendUrl = env.CLAWFORCE_BACKEND_URL || env.clawforce_backend_url
            || process.env.CLAWFORCE_BACKEND_URL
            || 'https://dev-backend-clawforce.altovation.in';

        const taskId = env.OPENCLAW_TASK_ID || process.env.OPENCLAW_TASK_ID;
        const collectionName = env.COLLECTION_NAME || process.env.COLLECTION_NAME;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            console.log(JSON.stringify({ status: "error", message: "No posts provided." }));
            process.exit(1);
        }

        // Aggregate targets from env
        let allTargets = [];
        const getEnv = (key) => env[key] || process.env[key] || env[key.toLowerCase()] || process.env[key.toLowerCase()];
        
        const rawPages = getEnv('LINKEDIN_PAGE_URN');
        if (rawPages) {
            try {
                const pages = JSON.parse(rawPages);
                if (Array.isArray(pages)) allTargets.push(...pages);
            } catch (e) {
                if (rawPages.includes('urn:li:')) allTargets.push({ urn: rawPages, name: 'Target Page', pic: null });
            }
        }
        
        const personalKeys = ['LINKEDIN_PERSONAL_INFO', 'LINKEDIN_PERSONAL_URN', 'LINKEDIN_SOCIAL_PERSONAL_URN'];
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
                 if (!allTargets.find(t => t.urn === val)) allTargets.push({ urn: val, name: 'Personal Account', pic: null });
            }
        }

        let defaultTarget = { urn: null, name: null, pic: null };
        if (allTargets.length > 0) defaultTarget = allTargets[0];

        let agentId = params.agentId || env.AGENT_ID || 'linkedin-manager';
        
        // If agentId is still default 'linkedin-manager', try to guess if it's actually something else 
        // based on available credentials, BUT only if no explicit agentId was provided.
        if (!params.agentId && !env.AGENT_ID) {
            if (getEnv('FACEBOOK_PAGE_LIST')) agentId = 'facebook-manager';
            else if (getEnv('INSTAGRAM_PAGE_LIST')) agentId = 'instagram-manager';
        }

        const formattedPosts = posts.map(p => {
            let targetUrn = p.targetUrn || defaultTarget.urn;
            let targetName = p.targetName || defaultTarget.name;
            let targetPic = p.targetPic || defaultTarget.pic;

            if (p.targetName) {
                 const match = allTargets.find(t => t.name && t.name.toLowerCase().includes(p.targetName.toLowerCase()));
                 if (match) {
                     targetUrn = match.urn;
                     targetName = match.name;
                     targetPic = match.pic;
                 }
            }

            return {
                ...p,
                agentId,
                scheduledAt: p.scheduledAt || p.scheduledFor,
                targetUrn,
                targetName,
                targetPic
            };
        });

        if (taskId) {
            console.error(`[schedule-posts] PRIMARY: calling /api/posts/batch-create-by-task`);
            const result = await postJson(backendUrl, '/api/posts/batch-create-by-task', {
                taskId,
                collectionName,
                posts: formattedPosts
            });

            if (result.statusCode === 200 || result.statusCode === 201) {
                const responseJson = JSON.parse(result.body);
                console.log(JSON.stringify({
                    status: "success",
                    message: `Successfully scheduled ${posts.length} posts via task-based endpoint.`,
                    count: responseJson.count,
                    ids: responseJson.ids
                }));
                process.exit(0);
            } else {
                console.error(`[schedule-posts] Primary path failed (${result.statusCode}): ${result.body}`);
            }
        }

        // Fallback
        const userId = env.USER_ID;
        const token = env.TOKEN;

        if (!userId || !token) {
            console.log(JSON.stringify({ status: "error", message: "No authentication available." }));
            process.exit(1);
        }

        console.error(`[schedule-posts] FALLBACK: calling /api/posts/batch-create`);
        const fallbackResult = await postJson(backendUrl, '/api/posts/batch-create', {
            userId,
            token,
            posts: formattedPosts
        });

        if (fallbackResult.statusCode === 200 || fallbackResult.statusCode === 201) {
            const responseJson = JSON.parse(fallbackResult.body);
            console.log(JSON.stringify({
                status: "success",
                message: `Successfully scheduled ${posts.length} posts via fallback endpoint.`,
                count: responseJson.count,
                ids: responseJson.ids
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
