# **Claw Mission Control: Firestore Database Schema**

This document defines the complete NoSQL structure for the Claw Mission Control platform.

## **1\. Global Registry (`/artifacts/{appId}/public/data/`)**

This path contains shared data managed primarily by the SuperAdmin.

### **1.1 `users` Collection**

* **Document ID:** User's Firebase UID  
* **Fields:**  
  * `displayName`: (string) Operative's full name.  
  * `email`: (string) Operative's email.  
  * `role`: (string) `admin` or `operator`.  
  * `status`: (string) `active` or `suspended`.  
  * `packageId`: (string) ID of the assigned package.  
  * `avatar`: (string) URL or initials.  
  * `createdAt`: (timestamp) Server time of creation.  
  * `lastSeen`: (timestamp) Last activity recorded.

### **1.2 `agents` Collection**

* **Document ID:** Unique Agent Slug (e.g., `market-researcher`)  
* **Fields:**  
  * `name`: (string) Professional name.  
  * `description`: (string) Capabilities summary.  
  * `category`: (string) Category slug.  
  * `tier`: (string) `basic` or `premium`.  
   * `icon`: (string) Lucide icon name.  

### **1.3 `packages` Collection**

* **Document ID:** Package Slug (e.g., `enterprise-elite`)  
* **Fields:**  
  * `name`: (string) Display name.  
  * `allowedAgentIds`: (array of strings) Agent IDs accessible.  
  * `maxConcurrentTasks`: (number) Task limit.

### **1.4 `categories` Collection**

* **Document ID:** Category Slug  
* **Fields:**  
  * `label`: (string) Display name.  
  * `color`: (string) Tailwind color class.

## **2\. Operational Data (`/artifacts/{appId}/public/data/tasks/`)**

### **2.1 `tasks` Collection**

* **Document ID:** Auto-generated ID (`OP-XXXXXX`)  
* **Fields:**  
  * `title`: (string) Mission title.  
  * `agentId`: (string) Assigned agent.  
  * `ownerId`: (string) UID of the user.  
  * `status`: (string) `enqueued`, `in-progress`, `waiting`, `completed`, `failed`.  
  * `progress`: (number) 0-100.  
  * `startTime`: (timestamp) Initiation time.  
  * `endTime`: (timestamp) Completion time.  
  * `metadata`: (map) Snapshot of values used for this specific run.

### **2.2 `tasks/{taskId}/comments` (Sub-collection)**

* **Fields:** `sender`, `text`, `timestamp`, `requiresAction`.

### **2.3 `tasks/{taskId}/logs` (Sub-collection)**

* **Fields:** `level`, `message`, `timestamp`.

## **3\. Private Configurations (`/artifacts/{appId}/users/{userId}/config/`)**

### **3.1 `agentSettings` Collection**

* **Document ID:** Agent Slug  
* **Fields:**  
  * `isConfigured`: (boolean) Flag to quickly check if the agent is ready for deployment.

## **4\. Database Setup Checklist**

1. **Security:** By storing `credentials` in the `/users/{userId}/` path, other operators cannot steal a user's API keys.  

