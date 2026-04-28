## Create Agent
1. openclaw agents add <agent-name>
2. Change workspace use workspace-<agent-name>
## Change SOUL.md

## Add Skill
in the skills folder add your skill in .md file
use skill format
update `openclaw.json` skills section

```json
"skills": {
    "install": {
      "nodeManager": "npm"
    },
    "entries": {
      "drive_tools": {
        "enabled": true
      },
      "post-to-linkedin": {
        "enabled": true
      },
      "post-to-facebook": {
        "enabled": true
      },
      "hello_world": {
        "enabled": true
      }
    }
}   
```


 