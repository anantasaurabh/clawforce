---
name: post-to-linkedin
version: 1.1.0
description: Handles automated posting to personal and community LinkedIn pages via Node.js.
metadata: {"clawdbot": {"emoji": "⏫", "requires": {"bins": ["node"]}}, "entrypoint": "node scripts/post.js"}
---

# LinkedIn Manager

This tool allows the agent to post updates to LinkedIn. It supports both personal profiles and community pages using a secure JSON-over-stdin protocol.

## Usage

The agent determines the target based on the context:
- **Personal**: Updates about your professional journey or personal projects.
- **Community**: Formal company announcements or community-wide updates.

## Protocol
The tool expects a JSON object via `stdin`:
```json
{
  "params": {
    "target": "personal",
    "content": "The post text"
  },
  "context": {
    "env": {
      "LINKEDIN_PERSONAL_TOKEN": "...",
      "LINKEDIN_PERSONAL_URN": "..."
    }
  }
}
```

## Example
```bash
node scripts/post.js <<EOF
{
  "params": {
    "target": "personal",
    "content": "Testing the LinkedIn Node.js tool! 🚀"
  },
  "context": {
    "env": {
      "LINKEDIN_PERSONAL_TOKEN": "your_token",
      "LINKEDIN_PERSONAL_URN": "your_urn"
    }
  }
}
EOF
```