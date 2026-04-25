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
 * Watch for new enqueued tasks
 */
const tasksQuery = db.collection(COLLECTIONS.TASKS).where('status', '==', 'enqueued');

tasksQuery.onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const task = change.doc.data();
      const taskId = change.doc.id;

      console.log(`[Task ${taskId}] Picked up: "${task.title || 'Untitled Operation'}"`);

      try {
        await processTask(taskId, task);
      } catch (error) {
        console.error(`[Task ${taskId}] Failed to start:`, error);
        await updateTaskStatus(taskId, 'failed', { error: error.message });
      }
    }
  });
});

/**
 * Main Task Processing Logic
 */
async function processTask(taskId, task) {
  const { ownerId, agentId, objective, title, description } = task;
  let agentReportedError = false;

  let message = objective || title || "No objective provided";
  if (description) {
    message += `\n\nContext/Description: ${description}`;
  }


  // 1. Mark as in-progress immediately to "lock" it
  await updateTaskStatus(taskId, 'in-progress', { startTime: admin.firestore.FieldValue.serverTimestamp() });

  // 2. Fetch Agent Settings (API Keys, etc.)
  const settingsPath = getUserAgentSettingsPath(ownerId);
  const settingsDoc = await db.collection(settingsPath).doc(agentId).get();
  const settings = settingsDoc.exists ? settingsDoc.data() : {};
  console.log(`[Task ${taskId}] Owner ID: ${ownerId}`);


  // 2.1 Fetch Global User Authorizations (OAuth Tokens)
  const authsPath = getUserAuthsPath(ownerId);
  const authsSnap = await db.collection(authsPath).get();
  const authorizations = {};
  authsSnap.forEach(doc => {
    const data = doc.data();
    if (data.credentials) {
      for (const [key, value] of Object.entries(data.credentials)) {
        authorizations[key] = value;
        authorizations[key.toUpperCase()] = value; // Support agent expectations for uppercase env vars
      }
    }
  });

  console.log(`[Task ${taskId}] Auth Keys: ${Object.keys(authorizations).join(', ')}`);


  // Also uppercase settings just in case
  const finalSettings = {};
  for (const [key, value] of Object.entries(settings)) {
    finalSettings[key] = value;
    finalSettings[key.toUpperCase()] = value;
  }


  console.log(`[Task ${taskId}] Credentials Found: ${Object.keys(authorizations).length / 2} pairs (mapped to ${Object.keys(authorizations).length} env vars)`);
  console.log(`[Task ${taskId}] Spawning OpenClaw for agent: ${agentId}`);
  console.log(`[Task ${taskId}] Message: "${message}"`);


  // 2.2 Fetch User's Global Review Token & Shared Parameters
  const userConfigPath = getUserConfigPath(ownerId);
  const userConfigSnap = await db.doc(userConfigPath).get();
  const userConfig = userConfigSnap.exists ? userConfigSnap.data() : {};
  const globalReviewToken = userConfig.globalReviewToken || '';
  const sharedParameters = userConfig.sharedParameters || {};

  // Merge shared parameters into authorizations (uppercase them for env vars)
  for (const [key, value] of Object.entries(sharedParameters)) {
    authorizations[key] = value;
    authorizations[key.toUpperCase()] = value;
  }

  // 2.3 Fetch System-wide Global Variables
  const globalVarsRef = db.collection(COLLECTIONS.GLOBAL_VARS).doc('settings');
  const globalVarsSnap = await globalVarsRef.get();
  const globalVars = globalVarsSnap.exists ? globalVarsSnap.data() : {};

  console.log(`[Task ${taskId}] Injecting USER_ID, TOKEN and ${Object.keys(globalVars).length} global vars.`);

  // 3. Prepare OpenClaw Command
  const env = {
    ...process.env,
    ...finalSettings, // Pass user settings as env vars
    ...authorizations, // Pass shared OAuth tokens as env vars
    ...globalVars, // Pass system-wide global vars (e.g. CLAWFORCE_BACKEND_URL)
    USER_ID: ownerId,
    TOKEN: globalReviewToken,
    CURRENT_TIME: new Date().toISOString(),
    OPENCLAW_TASK_ID: taskId
  };

  const command = `openclaw agent --agent "${agentId}" --session-id "${taskId}" --message "${message.replace(/"/g, '\\"')}" --local`;

  const clawProcess = spawn(command, {
    env,
    shell: true
  });

  // 3.1 Send Context (Auth Tokens, etc.) via STDIN
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

  console.log(`[Task ${taskId}] Sending context to STDIN...`);
  clawProcess.stdin.write(JSON.stringify(context) + "\n");
  clawProcess.stdin.end();

  // 4. Handle process errors (e.g., command not found)
  clawProcess.on('error', (error) => {
    console.error(`[Task ${taskId}] Failed to spawn OpenClaw:`, error);
    streamLog(taskId, 'stderr', `Failed to spawn OpenClaw: ${error.message}`);
    updateTaskStatus(taskId, 'failed', { error: error.message });
  });

  // 5. Stream Logs to Firestore
  clawProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(`[Task ${taskId}] STDOUT: ${output}`);
    streamLog(taskId, 'stdout', output);

    // Detect Generic Agent Events (Comments/Status)
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // 1. JSON Event Protocol
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const json = JSON.parse(trimmed);
          const content = json.content || json.summary || json.message;

          if (content && (json.type === 'comment' || json.status === 'success')) {
            console.log(`[Task ${taskId}] Detected agent comment via JSON.`);
            addComment(taskId, 'agent', content, agentId);
          }

          if (json.status === 'error') {
            console.log(`[Task ${taskId}] Agent reported an error: ${content}`);
            agentReportedError = true;
            addComment(taskId, 'agent', `⚠️ Error: ${content}`, agentId);
          }
        } catch (e) {
          // Not valid JSON or not our format, ignore
        }
      }

      // 2. Simple Prefix Protocol
      if (trimmed.startsWith('[Comment]')) {
        const content = trimmed.replace('[Comment]', '').trim();
        console.log(`[Task ${taskId}] Detected agent comment via prefix.`);
        addComment(taskId, 'agent', content, agentId);
      }
    }
  });

  clawProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[Task ${taskId}] STDERR: ${output}`);
    streamLog(taskId, 'stderr', output);
  });

  // 5. Handle Exit
  clawProcess.on('close', async (code) => {
    console.log(`[Task ${taskId}] Process exited with code ${code}`);
    const finalStatus = (code === 0 && !agentReportedError) ? 'completed' : 'failed';
    await updateTaskStatus(taskId, finalStatus, {
      endTime: admin.firestore.FieldValue.serverTimestamp(),
      exitCode: code
    });
  });
}

/**
 * Helper to update task document
 */
async function updateTaskStatus(taskId, status, extraData = {}) {
  await db.collection(COLLECTIONS.TASKS).doc(taskId).update({
    status,
    ...extraData
  });
}

/**
 * Helper to add a comment entry to the comments sub-collection
 */
async function addComment(taskId, role, content, authorName = 'System') {
  try {
    await db.collection(COLLECTIONS.TASKS).doc(taskId).collection('comments').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      role, // 'user' or 'agent'
      authorName,
      content
    });
  } catch (error) {
    console.error('Error writing comment to Firestore:', error);
  }
}

/**
 * Helper to add a log entry to the logs sub-collection
 */
async function streamLog(taskId, type, content) {
  try {
    await db.collection(COLLECTIONS.TASKS).doc(taskId).collection('logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      content
    });
  } catch (error) {
    console.error('Error writing log to Firestore:', error);
  }
}
