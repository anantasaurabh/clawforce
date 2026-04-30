import admin from 'firebase-admin';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { COLLECTIONS, getUserConfigPath, getUserAgentSettingsPath, getUserAuthsPath } from './constants.js';

import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultServiceAccountPath = path.join(__dirname, 'service-account.json');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: process.env.GCLOUD_PROJECT
});

const db = admin.firestore();

console.log('🚀 OpenClaw Runner started and listening for tasks...');

/**
 * Watch for new enqueued tasks (Public)
 */
db.collection(COLLECTIONS.TASKS).where('status', '==', 'enqueued').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const task = change.doc.data();
      const taskId = change.doc.id;
      console.log(`[Public Task ${taskId}] Picked up: "${task.title || 'Untitled Operation'}"`);
      try {
        await processTask(COLLECTIONS.TASKS, taskId, task);
      } catch (error) {
        console.error(`[Public Task ${taskId}] Failed to start:`, error);
        await updateTaskStatus(COLLECTIONS.TASKS, taskId, 'failed', { error: error.message });
      }
    }
  });
});

/**
 * Watch for new enqueued tasks (Silent)
 */
db.collection(COLLECTIONS.SILENT_TASKS).where('status', '==', 'enqueued').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const task = change.doc.data();
      const taskId = change.doc.id;
      console.log(`[Silent Task ${taskId}] Picked up: "${task.title || 'Untitled Operation'}"`);
      try {
        await processTask(COLLECTIONS.SILENT_TASKS, taskId, task);
      } catch (error) {
        console.error(`[Silent Task ${taskId}] Failed to start:`, error);
        await updateTaskStatus(COLLECTIONS.SILENT_TASKS, taskId, 'failed', { error: error.message });
      }
    }
  });
});

/**
 * Main Task Processing Logic
 */
async function processTask(collectionName, taskId, task) {
  const { ownerId, agentId, objective, title, description } = task;
  let agentReportedError = false;

  let message = objective || title || "No objective provided";
  if (description) {
    message += `\n\nContext/Description: ${description}`;
  }

  // 1. Mark as in-progress immediately to "lock" it
  await updateTaskStatus(collectionName, taskId, 'in-progress', { startTime: admin.firestore.FieldValue.serverTimestamp() });

  // 2. Fetch Agent Settings (API Keys, etc.)
  const settingsPath = getUserAgentSettingsPath(ownerId);
  const settingsDoc = await db.collection(settingsPath).doc(agentId).get();
  const settings = settingsDoc.exists ? settingsDoc.data() : {};
  console.log(`[${taskId}] Owner ID: ${ownerId}`);

  // 2.1 Fetch Global User Authorizations (OAuth Tokens)
  const authsPath = getUserAuthsPath(ownerId);
  const authsSnap = await db.collection(authsPath).get();
  const authorizations = {};
  authsSnap.forEach(doc => {
    const data = doc.data();
    if (data.credentials) {
      for (const [key, value] of Object.entries(data.credentials)) {
        authorizations[key] = value;
        authorizations[key.toUpperCase()] = value;
      }
    }
  });

  // Also uppercase settings just in case
  const finalSettings = {};
  for (const [key, value] of Object.entries(settings)) {
    finalSettings[key] = value;
    finalSettings[key.toUpperCase()] = value;
  }

  // 2.2 Fetch User's Global Review Token & Shared Parameters
  const userConfigPath = getUserConfigPath(ownerId);
  const userConfigSnap = await db.doc(userConfigPath).get();
  const userConfig = userConfigSnap.exists ? userConfigSnap.data() : {};
  const globalReviewToken = userConfig.globalReviewToken || '';
  const sharedParameters = userConfig.sharedParameters || {};

  for (const [key, value] of Object.entries(sharedParameters)) {
    authorizations[key] = value;
    authorizations[key.toUpperCase()] = value;
  }

  // 2.3 Fetch System-wide Global Variables
  const globalVarsRef = db.collection(COLLECTIONS.GLOBAL_VARS).doc('settings');
  const globalVarsSnap = await globalVarsRef.get();
  const globalVars = globalVarsSnap.exists ? globalVarsSnap.data() : {};

  // 3. Prepare OpenClaw Command
  const env = {
    ...process.env,
    ...finalSettings,
    ...authorizations,
    ...globalVars,
    USER_ID: ownerId,
    TOKEN: globalReviewToken,
    CURRENT_TIME: new Date().toISOString(),
    OPENCLAW_TASK_ID: taskId,
    COLLECTION_NAME: collectionName
  };

  const command = `openclaw agent --agent "${agentId}" --session-id "${taskId}" --message "${message.replace(/"/g, '\\"')}" --local`;

  const clawProcess = spawn(command, {
    env,
    shell: true
  });

  // 3.1 Send Context via STDIN
  const context = {
    context: {
      env: {
        ...finalSettings,
        ...authorizations,
        ...globalVars,
        USER_ID: ownerId,
        TOKEN: globalReviewToken,
        CURRENT_TIME: env.CURRENT_TIME
      }
    }
  };

  clawProcess.stdin.write(JSON.stringify(context) + "\n");
  clawProcess.stdin.end();

  // 4. Handle process errors
  clawProcess.on('error', (error) => {
    console.error(`[${taskId}] Failed to spawn OpenClaw:`, error);
    streamLog(collectionName, taskId, 'stderr', `Failed to spawn OpenClaw: ${error.message}`);
    updateTaskStatus(collectionName, taskId, 'failed', { error: error.message });
  });

  // 5. Stream Logs to Firestore
  clawProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(`[${taskId}] STDOUT: ${output}`);
    streamLog(collectionName, taskId, 'stdout', output);

    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const json = JSON.parse(trimmed);
          const content = json.content || json.summary || json.message;

          if (content && (json.type === 'comment' || json.status === 'success')) {
            addComment(collectionName, taskId, 'agent', content, agentId);
          }

          if (json.status === 'error') {
            agentReportedError = true;
            addComment(collectionName, taskId, 'agent', `⚠️ Error: ${content}`, agentId);
          }
        } catch (e) {}
      }
      if (trimmed.startsWith('[Comment]')) {
        const content = trimmed.replace('[Comment]', '').trim();
        addComment(collectionName, taskId, 'agent', content, agentId);
      }
    }
  });

  clawProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[${taskId}] STDERR: ${output}`);
    streamLog(collectionName, taskId, 'stderr', output);
  });

  // 6. Handle Exit
  clawProcess.on('close', async (code) => {
    console.log(`[${taskId}] Process exited with code ${code}`);
    const finalStatus = (code === 0 && !agentReportedError) ? 'completed' : 'failed';
    await updateTaskStatus(collectionName, taskId, finalStatus, {
      endTime: admin.firestore.FieldValue.serverTimestamp(),
      exitCode: code
    });
  });
}

/**
 * Helper to update task document
 */
async function updateTaskStatus(collectionName, taskId, status, extraData = {}) {
  await db.collection(collectionName).doc(taskId).update({
    status,
    ...extraData
  });
}

/**
 * Helper to add a comment entry
 */
async function addComment(collectionName, taskId, role, content, authorName = 'System') {
  try {
    await db.collection(collectionName).doc(taskId).collection('comments').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      role,
      authorName,
      content
    });
  } catch (error) {
    console.error('Error writing comment to Firestore:', error);
  }
}

/**
 * Helper to add a log entry
 */
async function streamLog(collectionName, taskId, type, content) {
  try {
    await db.collection(collectionName).doc(taskId).collection('logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      content
    });
  } catch (error) {
    console.error('Error writing log to Firestore:', error);
  }
}
