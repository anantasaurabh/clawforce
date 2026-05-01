---
name: post-tasks
version: 2.0.0
description: Spawns mission tasks via the Clawforce backend.
metadata: {"clawdbot": {"emoji": "🔧", "requires": {"bins": ["node"]}}, "entrypoint": "node post-tasks.js"}
---

# Task Spawner

This skill allows agents to spawn multiple mission tasks via the Clawforce backend.

It uses **task-ID-based authentication** to securely resolve the owner and mission context server-side.

## Parameters

- **tasks** (array, required): An array of task objects to be spawned.
- **missionId** (string, optional): The ID of the parent mission.
- **silent** (boolean, optional): If true, spawns as silent tasks.

## Required Environment Variables

- `OPENCLAW_TASK_ID` — The Firestore document ID of the active task.
- `OPENCLAW_MISSION_ID` — The ID of the active mission.
- `COLLECTION_NAME` — The Firestore collection path for the task.
- `CLAWFORCE_BACKEND_URL` — Backend base URL.

## Example (Native Call)
```json
{
  "params": {
    "tasks": [
      { "title": "Research Competitors", "agentId": "online-marketing-orchestrator" }
    ],
    "missionId": "m_123"
  },
  "context": {
    "env": {
      "OPENCLAW_TASK_ID": "task_abc",
      "OPENCLAW_MISSION_ID": "m_123",
      "COLLECTION_NAME": "artifacts/clwhq-001/public/data/tasks"
    }
  }
}
```

## Response

Success:
```json
{
  "status": "success",
  "message": "Successfully spawned X platform deployment tasks via task-based endpoint.",
  "taskIds": ["id1", "id2"]
}
```
