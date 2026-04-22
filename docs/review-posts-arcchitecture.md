# LinkedIn Post Review Workflow Walkthrough

I have implemented the requested LinkedIn post review workflow. This system allows Superadmins to define dynamic action buttons that open a secure review interface on the backend.

## Key Features

### 1. Dynamic Action Buttons
Superadmins can now add custom action buttons to any agent via the **Agent Registry**. These buttons support template URLs with dynamic placeholders.

- **Placeholders supported**: `{{userId}}` and `{{secretToken}}`.
- **Location**: These buttons appear prominently next to the "Create Task" button on the Agent Details page.

### 2. Secure Review Interface
Created a high-fidelity review interface hosted on the backend. It verifies users via a user-specific secret token.

- **URL**: `backend-clawforce.altovation.in/linkedin-manager/review?userId=...&token=...`
- **Features**: 
  - Real-time preview of pending posts.
  - Approve/Reject actions that update the shared database.
  - Premium UI designed with Tailwind CSS and Inter typography.

### 3. User-Specific Secret Tokens
Implemented a security layer where each user has a unique `reviewSecretToken` for each agent they configure. This token is automatically generated upon first visit to the agent's details page.

## Technical Changes

### Backend
- **[MODIFY] [index.js](file:///var/www/web/hq-clawforce.altovation.in/public_html/backend/index.js)**: Added `/linkedin-manager/review`, `/linkedin-manager/posts`, and `/linkedin-manager/approve` routes with token validation logic.
- **[NEW] [review.html](file:///var/www/web/hq-clawforce.altovation.in/public_html/backend/views/review.html)**: Created the self-contained review UI template.

### Frontend
- **[MODIFY] [Agents.jsx](file:///var/www/web/hq-clawforce.altovation.in/public_html/src/pages/Agents.jsx)**: Updated `AgentModal` to support managing `customActions`.
- **[MODIFY] [AgentDetails.jsx](file:///var/www/web/hq-clawforce.altovation.in/public_html/src/pages/AgentDetails.jsx)**: Integrated token initialization and dynamic button rendering.
- **[MODIFY] [firestore.js](file:///var/www/web/hq-clawforce.altovation.in/public_html/src/services/firestore.js)**: Added `initializeReviewToken` to handle secure token generation.

## Verification
- Verified code syntax and logical flow.
- The backend routes are properly wired to Firestore using the established `admin` SDK.
- The frontend UI seamlessly integrates with the existing high-fidelity design system.

> [!NOTE]
> The `linkedin-manager` agent should be configured to save pending posts into the `artifacts/clwhq-001/public/data/pending_posts` collection with the following status set to `pending`.
