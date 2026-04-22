# Backend Architecture Walkthrough

This document provides a comprehensive overview of the Clawforce HQ Backend, focusing on the OAuth integration and the Centralized Review System.

## Core Stack
- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: Firebase Firestore (via `firebase-admin`)
- **Authentication**: Custom Secret Tokens (Global and Agent-specific)

---

## 1. OAuth Workflow
The backend handles OAuth2.0 flows for various providers (LinkedIn, Facebook, etc.).

- **Route**: `GET /auth/:provider/callback`
- **Logic**:
  1. Decodes the `state` parameter to identify the `userId` and `agentId`.
  2. Exchanges the authorization `code` for an access token.
  3. Saves the credentials to Firestore at `artifacts/clwhq-001/userAuths/{userId}/services/{provider}`.
  4. Redirects the user back to the HQ frontend.

---

## 2. Centralized Review System
We have implemented a "Command Center" architecture to manage post approvals across multiple services.

### Key Components
- **Dashboard (`/review`)**: A central hub served via `dashboard.html`. It displays pending counts for all services.
- **Service Views (`/review/:agentId`)**: Modular HTML files for specific agents (e.g., `linkedin.html`).
- **Security Middleware**: `validateReviewToken` ensures that all requests to the review system are authorized.

### Authentication Strategy
1. **Global Review Token**: A single token stored in the user's root config (`userConfigs/{userId}`). This allows seamless navigation across all agents in the dashboard.
2. **Agent Secret Token**: A legacy/fallback token stored in `userConfigs/{userId}/agentSettings/{agentId}`.

### API Endpoints
- `GET /api/review/stats`: Aggregates "pending" post counts from the `pending_posts` collection, grouped by `agentId`.
- `GET /api/:agentId/posts`: Fetches posts for a specific agent (e.g., `/api/linkedin/posts`) with optional status filtering.
- `POST /api/:agentId/approve`: Handles approval or rejection of a post.
- `POST /api/:agentId/update`: Allows editing content, media, and scheduling.
- `POST /api/:agentId/create`: Enables manual drafting of new posts.
- `POST /api/posts/batch-create`: Enables bulk creation of posts for any agent in a single request.

#### Batch Create Example
```json
POST /api/posts/batch-create
{
  "userId": "user123",
  "token": "global_secret_xyz",
  "posts": [
    { "agentId": "linkedin", "content": "Hello LinkedIn!" },
    { "agentId": "facebook", "content": "Hello Facebook!", 
    "mediaUrl": "https://example.com/image.jpg", 
    "status": "approved",
    "scheduledAt": "2026-05-01T10:00:00Z" 
    }
  ]
}
```



---

## 3. Data Schema
### Pending Posts
Stored in `artifacts/clwhq-001/public/data/pending_posts`.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | String | ID of the agent (e.g., `linkedin-manager`) |
| `ownerId` | String | Firebase UID of the user |
| `content` | String | The text content of the post |
| `mediaUrl` | String | Optional URL for images/videos |
| `status` | String | `pending`, `approved`, or `rejected` |
| `scheduledAt` | Timestamp | Optional publication time |
| `createdAt` | Timestamp | Creation time |

---

## 4. UI Rendering
The backend serves static HTML files from the `views/` directory. These files use Vanilla JavaScript and Tailwind CSS (via CDN) to remain lightweight and self-contained. They interact with the backend APIs using `fetch`.
