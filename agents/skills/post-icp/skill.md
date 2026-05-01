---
name: post-icp
version: 2.0.0
description: Saves a generated Ideal Customer Profile (ICP) to the user's configuration via the Clawforce backend.
metadata: {"clawdbot": {"emoji": "📝", "requires": {"bins": ["node"]}}, "entrypoint": "node post-icp.js"}
---

# ICP Poster

This skill saves a generated Ideal Customer Profile (ICP) to the user's Firestore configuration via the Clawforce backend API.

It uses a **task-ID-based authentication** strategy: the backend looks up the active task in Firestore to resolve the correct `ownerId` server-side, bypassing any credential issues in the skill environment. A token-based fallback is available if STDIN context provides valid credentials.

## Usage

This skill is designed to be called natively by OpenClaw. It accepts a JSON object via command line argument, file path, or `stdin`.

## Parameters

- **icp** (string, required): The fully formatted ICP document in markdown (max 5000 characters).

## Required Environment Variables

These are injected by the runner and must be present in the OpenClaw agent environment:

- `OPENCLAW_TASK_ID` — The Firestore document ID of the active task. Used by the backend to resolve the correct user. **This is the primary auth mechanism.**
- `COLLECTION_NAME` — The Firestore collection path for the task (e.g. `artifacts/clwhq-001/public/data/silent_tasks`).
- `CLAWFORCE_BACKEND_URL` — Backend base URL (e.g. `https://dev-backend-clawforce.altovation.in`).

## Example (Native Call)
```json
{
  "params": {
    "icp": "# Ideal Customer Profile\n\n## Company Snapshot\n..."
  },
  "context": {
    "env": {
      "OPENCLAW_TASK_ID": "0Wu8B54VsU5qCWwcXQEN",
      "COLLECTION_NAME": "artifacts/clwhq-001/public/data/silent_tasks",
      "CLAWFORCE_BACKEND_URL": "https://dev-backend-clawforce.altovation.in"
    }
  }
}
```

## Manual Execution (CLI)
```bash
# Option A: Direct argument
node post-icp.js '{"params": {"icp": "# ICP\n..."}, "context": {"env": {"OPENCLAW_TASK_ID": "abc123"}}}'

# Option B: Temporary file (recommended for large ICPs)
cat > icp.json << 'EOF'
{
  "params": { "icp": "# ICP\n..." },
  "context": { "env": { "OPENCLAW_TASK_ID": "abc123" } }
}
EOF
node post-icp.js icp.json
```

## Response

Success (primary path):
```json
{
  "status": "success",
  "message": "ICP updated successfully via task-based endpoint."
}
```

Success (fallback path):
```json
{
  "status": "success",
  "message": "ICP updated successfully via fallback token endpoint."
}
```

Error:
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Authentication Flow

1. **Primary** (`/api/user/update-icp-by-task`): Uses `OPENCLAW_TASK_ID` + `COLLECTION_NAME`. The backend fetches the task from Firestore and writes the ICP to the correct user — no token required.
2. **Fallback** (`/api/user/update-config`): Uses `USER_ID` + `TOKEN` from the STDIN context env only. Never reads from `process.env` to avoid stale credentials from OpenClaw's own `.env` file.

## Notes

- `OPENCLAW_TASK_ID` and `COLLECTION_NAME` are task-specific and are **not** overridden by OpenClaw's `.env` file, making them safe to use across VPS boundaries.
- The ICP content is truncated to 5000 characters server-side.
- STDERR logs provide full debug output for each invocation (endpoint used, taskId, userId resolution).
