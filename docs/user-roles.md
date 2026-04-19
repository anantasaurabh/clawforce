# User Roles and Permissions: Clawforce HQ

This document outlines the security structure and functional logic for role-based access control (RBAC) in the Claw Mission Control platform.

## 1. Role Definitions

| Role | Persona | Permissions | Access Level |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | Infrastructure Owner | Can manage Users, Agents, Categories, and Packages. Full visibility into all Tasks across the platform. | **Control Plane** |
| **Operator** | End User | Can launch tasks using agents permitted by their assigned package. Can view/manage only their own tasks. | **Operational Plane** |

---

## 2. Authentication Logic

The system uses a dual-layer authentication strategy:
1.  **Identity Layer (Firebase Auth)**: Manages secure login, password resets, and token persistence.
2.  **Profile Layer (Firestore)**: Documents stored in `/artifacts/{appId}/public/data/users/{uid}` define the specific capabilities (role, package, status) associated with that identity.

### 2.1 Default Provisioning
Upon first login, the system automatically creates a profile in Firestore:
-   If the email matches `VITE_ADMIN_EMAIL`, the user is granted the **SuperAdmin** role.
-   Otherwise, the user is assigned the **Operator** role with a 'starter-pack' package by default.

---

## 3. Implementation Details

-   **Path Protection**: `ProtectedRoute.jsx` ensures only authenticated users can access the dashboard.
-   **UIPermissions**: The `useAuth()` hook provides `isAdmin` and `isOperator` flags to conditionally render UI elements (e.g., Administration sidebar sections).
-   **Data Isolation**: Firestore security rules (see `firestore-setup.md`) enforce that Operators can only query documents where `ownerId == request.auth.uid`.

---

## 4. Development Credentials

| User Type | Email | Password |
| :--- | :--- | :--- |
| **Mock SuperAdmin** | `admin@clawforce.hq` | `admin123` |
| **Real User** | Any valid email | Personal password |
