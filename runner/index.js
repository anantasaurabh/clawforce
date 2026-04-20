import admin from 'firebase-admin';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { COLLECTIONS, getUserConfigPath, getUserAuthsPath } from './constants.js';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';

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
  const { ownerId, agentId, objective } = task;

  // 1. Mark as in-progress immediately to "lock" it
  await updateTaskStatus(taskId, 'in-progress', { startTime: admin.firestore.FieldValue.serverTimestamp() });

  // 2. Fetch Agent Settings (API Keys, etc.)
  const settingsPath = getUserConfigPath(ownerId);
  const settingsDoc = await db.collection(settingsPath).doc(agentId).get();
  const settings = settingsDoc.exists ? settingsDoc.data() : {};

  // 2.1 Fetch Global User Authorizations (OAuth Tokens)
  const authsPath = getUserAuthsPath(ownerId);
  const authsSnap = await db.collection(authsPath).get();
  const authorizations = {};
  authsSnap.forEach(doc => {
    const data = doc.data();
    if (data.credentials) {
      Object.assign(authorizations, data.credentials);
    }
  });

  console.log(`[Task ${taskId}] Spawning OpenClaw for agent: ${agentId}`);

  // 3. Prepare OpenClaw Command
  // Adjust arguments based on how openclaw CLI expects them
  // Usage: openclaw agent --skill <agentId> --message <objective>
  const env = {
    ...process.env,
    ...settings, // Pass user settings as env vars
    ...authorizations, // Pass shared OAuth tokens as env vars
    OPENCLAW_TASK_ID: taskId
  };

  const clawProcess = spawn('openclaw', ['agent', '--message', `"[${agentId}] ${objective}"`], { env });

  // 4. Stream Logs to Firestore
  clawProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(`[Task ${taskId}] STDOUT: ${output}`);
    streamLog(taskId, 'stdout', output);
  });

  clawProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[Task ${taskId}] STDERR: ${output}`);
    streamLog(taskId, 'stderr', output);
  });

  // 5. Handle Exit
  clawProcess.on('close', async (code) => {
    console.log(`[Task ${taskId}] Process exited with code ${code}`);
    const finalStatus = code === 0 ? 'completed' : 'failed';
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
