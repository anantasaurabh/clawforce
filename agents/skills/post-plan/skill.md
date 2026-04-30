---
name: post-plan
version: 1.0.0
description: Drafts and outputs strategic plans for missions via Node.js.
metadata: {"clawdbot": {"emoji": "📋", "requires": {"bins": ["node"]}}, "entrypoint": "node post-plan.js"}
---

# Plan Creator

This skill allows agents to draft strategic plans and output them for mission runners to process. It uses a JSON-over-stdin protocol to receive plan documents and outputs them for downstream processing.

## Usage

This skill is designed to be called natively by OpenClaw. However, if running manually, it accepts a JSON object via command line argument, file path, or `stdin`.

## Parameters

- **plan** (string or object, required): The strategic plan document to be drafted

## Example (Native Call)
```json
{
  "params": {
    "plan": "Phase 1: Research...\nPhase 2: Strategy..."
  }
}
```

## Manual Execution (CLI)
To avoid complex shell redirections, pass the JSON directly as an argument or use a temporary file:

```bash
# Option A: Direct argument (for small plans)
node post-plan.js '{"params": {"plan": "..."}}'

# Option B: Temporary file (Recommended for large plans)
cat > plan.json <<'EOF'
{ "params": { "plan": "..." } }
EOF
node post-plan.js plan.json
```

## Response

Success:
```json
{
  "status": "success",
  "message": "Strategic plan drafted successfully.",
  "plan_doc": "Phase 1: Research and analysis\nPhase 2: Strategy development\nPhase 3: Implementation"
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

- The mission runner intercepts single-line JSON outputs from this skill
- The plan document is passed through as-is to the response output
