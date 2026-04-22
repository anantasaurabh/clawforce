# Firebase Service Account Setup Guide

To allow the **OpenClaw Runner** to securely read/write to your Firestore database (watching tasks and uploading logs), you need to generate a Service Account JSON file.

### Step 1: Generate the Service Account Key
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project (**hq-clawforce**).
3.  Click the **Gear Icon (Project Settings)** in the left sidebar.
4.  Navigate to the **Service Accounts** tab.
5.  Ensure **Node.js** is selected.
6.  Click the **Generate new private key** button.
7.  A `.json` file will download to your computer.

### Step 2: Add the Key to the Server
1.  Rename the downloaded file to `service-account.json`.
2.  Upload/Move this file into the `runner/` directory of this project:
    `path: /var/www/web/hq-clawforce.altovation.in/public_html/runner/service-account.json`

> [!WARNING]
> **DO NOT** commit this `service-account.json` file to Git. I have added it to `.gitignore` automatically for you.

### Step 3: Configure Environment Variables
I have created a `.env.example` in the `runner/` folder. You will need to create a `.env` file in the same folder and set:
```bash
GCLOUD_PROJECT="your-project-id"
# FIREBASE_SERVICE_ACCOUNT_PATH="./service-account.json" (already defaulted)
```

---

### Security Note
The Service Account gives the runner full administrative access to your project. Ensure the file is kept secure and only accessible by the runner process.

### Run using
node index.js

