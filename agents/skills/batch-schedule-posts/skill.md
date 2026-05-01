---
name: batch-schedule-posts
version: 2.0.0
description: Batch schedules multiple LinkedIn/Social posts via the Clawforce backend.
metadata: {
  "clawdbot": { "emoji": "📅", "requires": { "bins": ["node"] } },
  "entrypoint": "node schedule-posts.js"
}
---

# 📅 Batch Post Scheduler

This tool queues multiple posts to the **HQ-Clawforce** backend using task-ID based authentication.

## Parameters

- **posts** (array, required): An array of post objects.
  - `content`: Post text.
  - `scheduledAt`: ISO timestamp.
  - `status`: Optional status ("approved" or "pending").
  - `targetName`: Optional name of the page/profile to match.
  - `agentId`: Optional. The ID of the agent calling this skill (e.g., "linkedin-manager"). Defaults to "linkedin-manager".

## Required Environment Variables

- `OPENCLAW_TASK_ID` — The Firestore document ID of the active task.
- `COLLECTION_NAME` — The Firestore collection path for the task.
- `CLAWFORCE_BACKEND_URL` — Backend base URL.
- `LINKEDIN_PAGE_URN` — (Optional) Injected to help match targets.

## Example (Native Call)
```json
{
  "params": {
    "posts": [
      { "content": "Hello World", "scheduledAt": "2024-05-01T12:00:00Z" }
    ]
  },
  "context": {
    "env": {
      "OPENCLAW_TASK_ID": "task_abc",
      "COLLECTION_NAME": "artifacts/clwhq-001/public/data/tasks"
    }
  }
}
```