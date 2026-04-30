---
name: post-tasks
version: 1.0.0
description: Spawns execution tasks across social networking managers via Node.js.
metadata: {"clawdbot": {"emoji": "🚀", "requires": {"bins": ["node"]}}, "entrypoint": "node post-tasks.js"}
---

# Task Dispatcher

This skill allows agents to break down approved strategic plans into independent, execution-ready tasks for appropriate subordinate platform operators.

## Usage

This skill is designed to be called natively by OpenClaw. However, if running manually, it accepts a JSON object via command line argument, file path, or `stdin`.

## Parameters

- **tasks** (array, required): An array of task objects specifying operational commands
- **silent** (boolean, optional): If true, tasks will be created in the `silent-tasks` collection and won't appear in the public dashboard. Default is `false`.

## Example (Native Call)
```json
{
  "params": {
    "tasks": [
      {
        "title": "Deploy Instagram Test",
        "description": "Post new branding metrics layout.",
        "agentId": "instagram-manager"
      }
    ]
  }
}
```

## Manual Execution (CLI)
To avoid complex shell redirections, pass the JSON directly as an argument or use a temporary file:

```bash
# Option A: Direct argument
node post-tasks.js '{"params": {"tasks": [...]}}'

# Option B: Temporary file
cat > tasks.json <<'EOF'
{ "params": { "tasks": [...] } }
EOF
node post-tasks.js tasks.json
```

## Response

Success:
```json
{
  "status": "success",
  "message": "Successfully spawned 1 platform deployment tasks.",
  "taskIds": ["..."]
}
```

Error:
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Notes

- Only valid Agent IDs are acceptable: `linkedin-manager`, `facebook-manager`, `instagram-manager`
- Operations map dynamically upon resolution loops.
