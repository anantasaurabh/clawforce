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

    // 2. Credential Validation & Selection (With fallback to process.env)
    const getEnv = (key) => env[key] || process.env[key];

    let token = null;
    let tokenKey = "NONE";

    const findToken = (keys) => {
        for (const k of keys) {
            const val = getEnv(k);
            if (val && !val.includes("your_")) {
                tokenKey = k;
                return val;
            }
        }
        return null;
    };

    let urn = null;
    let urnKey = "NONE";

    // Helper to extract URN from potential JSON array or raw string
    const resolveUrn = (val) => {
        if (!val) return null;
        if (typeof val === 'string' && val.startsWith('[')) {
            try {
                const arr = JSON.parse(val);
                return arr[0]?.urn;
            } catch (e) { return val; }
        }
        return val;
    };

    if (target === 'personal') {
        token = findToken(['LINKEDIN_SOCIAL_TOKEN', 'linkedin_social_token', 'LINKEDIN_PERSONAL_TOKEN', 'linkedin_personal_token']);
        // Priority: Use the URN that matches our chosen token provider to avoid mismatch
        const personalUrnKeys = (tokenKey.includes('SOCIAL')) 
            ? ['linkedin_social_personal_urn', 'LINKEDIN_SOCIAL_URN', 'LINKEDIN_PERSONAL_URN'] 
            : ['LINKEDIN_PERSONAL_URN', 'linkedin_personal_urn', 'LINKEDIN_SOCIAL_URN'];

        const rawUrn = findToken(personalUrnKeys);
        urn = resolveUrn(rawUrn);
        urnKey = rawUrn ? "LINKEDIN_URN_RESOLVED" : "NONE";
    } else {
        // Community/Organization Target
        token = findToken(['LINKEDIN_COMMUNITY_TOKEN', 'LINKEDIN_SOCIAL_TOKEN', 'linkedin_social_token']);

        // Check if explicit community URN is valid (not a placeholder)
        const explicitUrn = getEnv('LINKEDIN_COMMUNITY_URN');
        const isExplicitValid = explicitUrn && !explicitUrn.includes('your_');

        if (isExplicitValid) {
            urn = explicitUrn;
            urnKey = "LINKEDIN_COMMUNITY_URN";
        } else {
            const pageUrnRaw = getEnv('LINKEDIN_PAGE_URN') || getEnv('linkedin_social_urn');
            if (pageUrnRaw) {
                urnKey = "LINKEDIN_PAGE_URN";
                try {
                    const pages = JSON.parse(pageUrnRaw);
                    if (Array.isArray(pages) && pages.length > 0) {
                        urn = pages[0].urn;
                    }
                } catch (e) {
                    urn = pageUrnRaw; // Fallback to raw string
                }
            }
        }
    }

    // Clean prefix for organization URNs if they contain the full URN string
    // but the API expects just the ID part (or vice versa)
    // Actually, ugcPosts author usually wants the full URN.
    // However, our code was stripping it before. 
    // Let's ensure we have the numeric part if needed, but usually full URN is safer.
    // Preserve full URN if available

    // Final sanity check for placeholders or missing values
    const isTokenPlaceholder = typeof token === 'string' && token.includes("your_");
    const isUrnPlaceholder = typeof urn === 'string' && urn.includes("your_");

    if (!token || !urn || isTokenPlaceholder || isUrnPlaceholder) {
        sendError(`Missing ${target} credentials. Please authorize LinkedIn Social in System Parameters or set explicit Community Tokens.`, "AUTH_FAILURE");
    }

    // Masked token for logging
    const maskedToken = typeof token === 'string' ? (token.substring(0, 5) + "..." + token.substring(token.length - 5)) : "N/A";
    const fullUrn = target === 'personal' ? `urn:li:person:${urn}` : `urn:li:organization:${urn}`;

    console.log(JSON.stringify({
        type: "log",
        content: `Initiating post to ${target} URN: ${fullUrn} (via ${urnKey}). Using token from ${tokenKey} (${maskedToken})`
    }));

    // 3. Post to LinkedIn using native https (no dependencies needed)
    const authorUrn = urn.includes(':') ? urn.replace('urn:li:person:', 'urn:li:member:') : (target === 'personal' ? `urn:li:member:${urn}` : `urn:li:organization:${urn}`);

    const postData = JSON.stringify({
        author: authorUrn,
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
                } catch (e) { }

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
