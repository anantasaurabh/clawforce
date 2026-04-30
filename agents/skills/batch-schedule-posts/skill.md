---
name: batch-schedule-posts
version: 1.0.0
description: Batch schedules multiple LinkedIn posts via the HQ-Clawforce backend.
metadata: {
  "clawdbot": { "emoji": "📅", "requires": { "bins": ["node"] } },
  "entrypoint": "node schedule-posts.js",
  "auth": ["CLAWFORCE_BACKEND_URL", "USER_ID", "TOKEN"]
}
---

# 📅 Batch Post Scheduler

This tool queues multiple posts to the **HQ-Clawforce** backend. It is the primary tool for high-volume content planning.

## Protocol
The tool expects a JSON object via `stdin` with an array of post objects:
```json
{
  "params": {
    "posts": [
      { 
        "content": "Post text here", 
        "scheduledAt": "ISO_TIMESTAMP",
        "targetName": "Page Name",
        "targetUrn": "urn:li:organization:123",
        "targetPic": "https://..."
      }
    ]
  },
  "context": {
    "env": {
      "CLAWFORCE_BACKEND_URL": "...",
      "USER_ID": "...",
      "TOKEN": "...",
      "LINKEDIN_PAGE_URN": "[...]"
    }
  }
}
```

**Note**: The agent should parse the `LINKEDIN_PAGE_URN` array from the environment to find the exact `urn` and `pic` for the requested target. Pass these explicitly in `targetUrn` and `targetPic`.

## Example
```bash
node schedule-posts.js <<EOF
{
  "params": {
    "posts": [
      { "content": "AI is the future.", "scheduledAt": "2026-05-01T10:00:00Z", "targetName": "Tech Innovations", "targetUrn": "urn:li:organization:456", "targetPic": "https://example.com/tech.png" },
      { "content": "Design matters.", "scheduledAt": "2026-05-02T10:00:00Z", "targetName": "Design Hub", "targetUrn": "urn:li:organization:789", "targetPic": "null"   }
    ]
  },
  "context": {
    "env": {
      "CLAWFORCE_BACKEND_URL": "http://localhost:3000",
      "USER_ID": "admin",
      "TOKEN": "secret_token",
      "LINKEDIN_PAGE_URN": "[{\"name\": \"Tech Innovations\", \"urn\": \"urn:li:organization:456\", \"pic\": \"https://example.com/tech.png\"}, {\"name\": \"Design Hub\", \"urn\": \"urn:li:organization:789\", \"pic\": null}]"
    }
  }
}
EOF
```