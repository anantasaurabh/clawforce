---
name: post-to-linkedin
version: 2.0.0
description: Handles automated posting to LinkedIn via the Clawforce backend proxy.
metadata: {"clawdbot": {"emoji": "⏫", "requires": {"bins": ["node"]}}, "entrypoint": "node scripts/post.js"}
---

# LinkedIn Poster

This tool allows agents to post updates to LinkedIn by proxying through the Clawforce backend.

It uses **task-ID-based authentication** to resolve user tokens securely on the backend, preventing credential leakage on the agent environment.

## Parameters

- **target** (string, optional): `personal` or `community`. Defaults to `personal`.
- **content** (string, required): The post text.

## Required Environment Variables

- `OPENCLAW_TASK_ID` — The Firestore document ID of the active task.
- `COLLECTION_NAME` — The Firestore collection path for the task.
- `CLAWFORCE_BACKEND_URL` — Backend base URL.

## Example
```json
{
  "params": {
    "target": "personal",
    "content": "Testing the LinkedIn Node.js tool! 🚀"
  },
  "context": {
    "env": {
      "OPENCLAW_TASK_ID": "task_abc",
      "COLLECTION_NAME": "artifacts/clwhq-001/public/data/tasks"
    }
  }
}
```