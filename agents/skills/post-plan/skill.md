---
name: post-plan
version: 2.0.0
description: Drafts and outputs strategic plans for missions via the Clawforce backend.
metadata: {"clawdbot": {"emoji": "📋", "requires": {"bins": ["node"]}}, "entrypoint": "node post-plan.js"}
---

# Plan Creator

This skill allows agents to draft strategic plans and save them to a mission document via the Clawforce backend.

It uses **task-ID-based authentication**: the backend looks up the active task in Firestore to resolve the correct `ownerId` server-side, ensuring reliability across VPS boundaries.

## Usage

This skill is designed to be called natively by OpenClaw. It accepts a JSON object via command line argument, file path, or `stdin`.

## Parameters

- **plan** (string, required): The strategic plan document to be drafted.
- **missionId** (string, optional): The ID of the mission. If not provided, it will be looked up from the environment.

## Required Environment Variables

- `OPENCLAW_TASK_ID` — The Firestore document ID of the active task.
- `OPENCLAW_MISSION_ID` — The ID of the active mission.
- `COLLECTION_NAME` — The Firestore collection path for the task.
- `CLAWFORCE_BACKEND_URL` — Backend base URL.

## Example (Native Call)
```json
{
  "params": {
    "plan": "Phase 1: Research...\nPhase 2: Strategy...",
    "missionId": "m_123"
  },
  "context": {
    "env": {
      "OPENCLAW_TASK_ID": "task_abc",
      "OPENCLAW_MISSION_ID": "m_123",
      "COLLECTION_NAME": "artifacts/clwhq-001/public/data/tasks",
      "CLAWFORCE_BACKEND_URL": "https://dev-backend-clawforce.altovation.in"
    }
  }
}
```

## Response

Success:
```json
{
  "status": "success",
  "message": "Strategic plan drafted successfully via task-based endpoint.",
  "plan_doc": "..."
}
```

Error:
```json
{
  "status": "error",
  "message": "Error description"
}
```
