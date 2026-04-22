import fs from 'fs';
import https from 'https';

// 1. Read input from OpenClaw (JSON over Stdin)
const rawInput = fs.readFileSync(0, 'utf8');

if (!rawInput) {
    sendError("No input received from OpenClaw.");
}

try {
    const data = JSON.parse(rawInput);
    const params = data.params || {};
    const env = data.context?.env || {};

    const target = params.target || 'personal';
    const content = params.content;

    // 2. Credential Validation
    const token = target === 'personal' ? env.LINKEDIN_PERSONAL_TOKEN : env.LINKEDIN_COMMUNITY_TOKEN;
    const urn = target === 'personal' ? env.LINKEDIN_PERSONAL_URN : env.LINKEDIN_COMMUNITY_URN;

    if (!token || !urn || token.includes("your_token")) {
        sendError(`Missing ${target} credentials in context.env.`, "AUTH_FAILURE");
    }

    // 3. Post to LinkedIn using native https (no dependencies needed)
    const postData = JSON.stringify({
        author: target === 'personal' ? `urn:li:person:${urn}` : `urn:li:organization:${urn}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: content },
                shareMediaCategory: "NONE"
            }
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    });

    const options = {
        hostname: 'api.linkedin.com',
        path: '/v2/ugcPosts',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            if (res.statusCode === 201 || res.statusCode === 200) {
                let link = null;
                try {
                    const response = JSON.parse(body);
                    if (response.id) {
                        // Construct the public URL from the URN
                        link = `https://www.linkedin.com/feed/update/${response.id}`;
                    }
                } catch (e) {}

                console.log(JSON.stringify({
                    status: "success",
                    message: `Successfully posted to LinkedIn ${target}.`,
                    link: link
                }));
            } else {
                sendError(`LinkedIn API returned ${res.statusCode}: ${body}`, res.statusCode.toString());
            }
        });
    });

    req.on('error', (e) => sendError(e.message));
    req.write(postData);
    req.end();

} catch (err) {
    sendError("Failed to parse OpenClaw JSON payload: " + err.message);
}

function sendError(message, code = "INTERNAL_ERROR") {
    console.log(JSON.stringify({ status: "error", error_code: code, message: message }));
    process.exit(1); // Force OpenClaw to recognize the failure
}
