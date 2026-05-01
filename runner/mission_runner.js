import admin from 'firebase-admin';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { COLLECTIONS, getUserConfigPath, getUserAuthsPath } from './constants.js';

import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultServiceAccountPath = path.join(__dirname, 'service-account.json');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;

// Initialize Firebase Admin (only if not already initialized by another runner)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: process.env.GCLOUD_PROJECT
  });
}

const db = admin.firestore();

console.log('🚀 OpenClaw Mission Runner started and listening for strategic missions...');

/**
 * Watch for new Planning missions
 */
const missionsQuery = db.collection(COLLECTIONS.MISSIONS).where('status', '==', 'Planning');

missionsQuery.onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const mission = change.doc.data();
      const missionId = change.doc.id;

      console.log(`[Mission ${missionId}] Picked up: "${mission.title || 'Untitled Mission'}" for tab: ${mission.tab_slug}`);

      try {
        await processMission(missionId, mission);
      } catch (error) {
        console.error(`[Mission ${missionId}] Failed to start:`, error);
        await updateMissionStatus(missionId, 'Failed', { error: error.message });
      }
    }
  });
});

/**
 * Watch for Approved missions to spawn tasks
 */
const approvedMissionsQuery = db.collection(COLLECTIONS.MISSIONS).where('status', '==', 'Approved');

approvedMissionsQuery.onSnapshot(snapshot => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added' || change.type === 'modified') {
      const mission = change.doc.data();
      const missionId = change.doc.id;
      
      // Prevent double spawning
      if (mission.tasksSpawned) return;

      console.log(`[Mission ${missionId}] Approved. Spawning tasks from plan...`);
      
      try {
        await spawnTasksFromPlan(missionId, mission);
        await updateMissionStatus(missionId, 'In-Progress', { tasksSpawned: true });
      } catch (error) {
        console.error(`[Mission ${missionId}] Failed to spawn tasks:`, error);
        await updateMissionStatus(missionId, 'Failed', { error: error.message });
      }
    }
  });
});

/**
 * Watch for new user comments on Waiting missions to resume them
 */
db.collection(COLLECTIONS.MISSIONS).where('status', '==', 'Waiting').onSnapshot(snapshot => {
  snapshot.docs.forEach(missionDoc => {
    const missionId = missionDoc.id;
    // Listen for new comments on this waiting mission
    db.collection(COLLECTIONS.MISSIONS).doc(missionId)
      .collection('comments')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .onSnapshot(async commentSnap => {
        if (commentSnap.empty) return;
        const latestComment = commentSnap.docs[0].data();
        // Only re-trigger if the latest comment is from the user
        if (latestComment.role !== 'user') return;
        // Check mission is still Waiting
        const missionSnap = await db.collection(COLLECTIONS.MISSIONS).doc(missionId).get();
        if (!missionSnap.exists || missionSnap.data().status !== 'Waiting') return;
        console.log(`[Mission ${missionId}] User replied to waiting mission. Re-triggering...`);
        await streamLog(missionId, 'stdout', `[System] User replied: "${latestComment.content}". Re-triggering agent...`);
        await db.collection(COLLECTIONS.MISSIONS).doc(missionId).update({
          status: 'Planning',
          waitingMessage: null,
          userReply: latestComment.content,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
  });
});

/**
 * Parse the plan and spawn tasks in the TASKS collection
 */
async function spawnTasksFromPlan(missionId, mission) {
  // Simple heuristic: one execution task for the entire plan using the same orchestrator agent (or could be parsed)
  // The user stated "when plan is approved a new task will be created".
  const tasksRef = db.collection(COLLECTIONS.TASKS);
  
  await tasksRef.add({
    title: `Execute Plan: ${mission.title}`,
    description: `Auto-generated execution task from approved strategic plan. Plan context:\n\n${mission.plan_doc || ''}`,
    agentId: mission.tab_slug || 'system',
    ownerId: mission.ownerId,
    status: 'enqueued',
    progress: 0,
    startTime: admin.firestore.FieldValue.serverTimestamp(),
    metadata: {
      parent_mission_id: missionId
    }
  });
  
  console.log(`[Mission ${missionId}] Task spawned successfully.`);
}

/**
 * Main Mission Processing Logic
 */
async function processMission(missionId, mission) {
  const { ownerId, tab_slug, title } = mission;
  let agentReportedError = false;

  // If re-triggered from Waiting state, only send the user's reply.
  // OpenClaw maintains full session history so it already has all prior context.
  const message = mission.userReply || title || "No objective provided";

  // 1. Mark as in-progress immediately to "lock" it
  await updateMissionStatus(missionId, 'In-Progress', { startTime: admin.firestore.FieldValue.serverTimestamp() });

  // 2. Fetch Global User Authorizations (OAuth Tokens)
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

  // 2.1 Fetch User's Global Review Token & Shared Parameters
  const userConfigPath = `artifacts/clwhq-001/userConfigs/${ownerId}`;
  const userConfigSnap = await db.doc(userConfigPath).get();
  const userConfig = userConfigSnap.exists ? userConfigSnap.data() : {};
  const globalReviewToken = userConfig.globalReviewToken || '';
  const sharedParameters = userConfig.sharedParameters || {};
  const companyId = userConfig.companyId || ownerId;

  console.log(`[Mission ${missionId}] Fetching config for ${ownerId} at ${userConfigPath}. Found: ${userConfigSnap.exists}`);
  console.log(`[Mission ${missionId}] GlobalReviewToken: ${globalReviewToken ? 'YES (len:' + globalReviewToken.length + ')' : 'NO'}`);

  for (const [key, value] of Object.entries(sharedParameters)) {
    authorizations[key] = value;
    authorizations[key.toUpperCase()] = value;
  }

  // 2.2 Fetch System-wide Global Variables
  const globalVarsRef = db.collection(COLLECTIONS.GLOBAL_VARS).doc('settings');
  const globalVarsSnap = await globalVarsRef.get();
  const globalVars = globalVarsSnap.exists ? globalVarsSnap.data() : {};

  // 3. Prepare OpenClaw Command
  const env = {
    ...process.env,
    ...authorizations,
    ...globalVars,
    USER_ID: ownerId,
    TOKEN: globalReviewToken,
    COMPANY_ID: companyId,
    CURRENT_TIME: new Date().toISOString(),
    OPENCLAW_MISSION_ID: missionId,
    OPENCLAW_TASK_ID: missionId,
    COLLECTION_NAME: COLLECTIONS.MISSIONS,
    OPENCLAW_SKILLS_PATH: '/var/www/web/hq-clawforce.altovation.in/public_html/agents/skills',
    CLAWFORCE_BACKEND_URL: globalVars.CLAWFORCE_BACKEND_URL || 'https://dev-backend-clawforce.altovation.in'
  };

  console.log(`[Mission ${missionId}] TOKEN being injected: ${env.TOKEN ? 'YES' : 'NO'}`);

  const command = `openclaw agent --agent "${tab_slug}" --session-id "${missionId}" --message "${message.replace(/"/g, '\\"')}" --local`;

  console.log(`[Mission ${missionId}] Spawning OpenClaw for tab: ${tab_slug}`);

  const clawProcess = spawn(command, {
    env,
    shell: true
  });

  // 3.1 Send Context via STDIN
  const context = {
    context: {
      env: {
        ...authorizations,
        ...globalVars,
        USER_ID: ownerId,
        TOKEN: globalReviewToken,
        COMPANY_ID: companyId,
        CURRENT_TIME: env.CURRENT_TIME,
        OPENCLAW_MISSION_ID: missionId,
        OPENCLAW_TASK_ID: missionId,
        COLLECTION_NAME: COLLECTIONS.MISSIONS
      }
    }
  };

  clawProcess.on('error', (err) => {
    console.error(`[Mission ${missionId}] Failed to start OpenClaw:`, err.message);
  });

  clawProcess.stdin.on('error', (err) => {
    console.error(`[Mission ${missionId}] Stdin error:`, err.message);
  });

  try {
    clawProcess.stdin.write(JSON.stringify(context) + "\n");
    clawProcess.stdin.end();
  } catch (err) {
    console.error(`[Mission ${missionId}] Error writing context to stdin:`, err.message);
  }

  // 4. Handle process errors
  clawProcess.on('error', (error) => {
    console.error(`[Mission ${missionId}] Failed to spawn OpenClaw:`, error);
    streamLog(missionId, 'stderr', `Failed to spawn OpenClaw: ${error.message}`);
    streamComment(missionId, 'agent', `⚠️ Failed to start mission: ${error.message}`);
    updateMissionStatus(missionId, 'Failed', { error: error.message });
  });

  // 5. Stream Logs to Firestore
  clawProcess.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(`[Mission ${missionId}] STDOUT: ${output}`);
    streamLog(missionId, 'stdout', output);

    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const json = JSON.parse(trimmed);
          const content = json.content || json.summary || json.message;
          const planDoc = json.plan_doc;

          // Plan submitted
          if (planDoc) {
             console.log(`[Mission ${missionId}] Plan generated.`);
             db.collection(COLLECTIONS.MISSIONS).doc(missionId).update({
                plan_doc: planDoc,
                status: mission.approvePlanBeforeLaunch ? 'WaitingApproval' : 'Approved'
             });
          }

          // Agent comment / informational update
          if (json.type === 'comment' && content) {
            console.log(`[Mission ${missionId}] Agent comment: ${content}`);
            streamComment(missionId, 'agent', content);
          }

          // Agent needs human input
          if (json.status === 'waiting' && content) {
            console.log(`[Mission ${missionId}] Agent is waiting for human input: ${content}`);
            streamComment(missionId, 'agent', content);
            db.collection(COLLECTIONS.MISSIONS).doc(missionId).update({
              status: 'Waiting',
              waitingMessage: content,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }

          // Terminal error
          if (json.status === 'error') {
            console.log(`[Mission ${missionId}] Error: ${content}`);
            streamComment(missionId, 'agent', content);
            agentReportedError = true;
          }
        } catch (e) {}
      }
    }
  });

  clawProcess.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(`[Mission ${missionId}] STDERR: ${output}`);
    streamLog(missionId, 'stderr', output);
  });

  // 6. Handle Exit
  clawProcess.on('close', async (code) => {
    console.log(`[Mission ${missionId}] Process exited with code ${code}`);
    // Only update if it wasn't already transitioned to a terminal/waiting state
    const docSnap = await db.collection(COLLECTIONS.MISSIONS).doc(missionId).get();
    const currentStatus = docSnap.exists ? docSnap.data().status : 'In-Progress';
    
    if (currentStatus === 'In-Progress') {
        const finalStatus = (code === 0 && !agentReportedError) ? 'Completed' : 'Failed';
        if (finalStatus === 'Failed' && !agentReportedError) {
          streamComment(missionId, 'agent', `❌ Mission execution failed (Exit Code: ${code}). Please check the logs for details.`);
        }
        await updateMissionStatus(missionId, finalStatus, {
            endTime: admin.firestore.FieldValue.serverTimestamp(),
            exitCode: code
        });
    }
    // If status is 'Waiting', don't overwrite — it stays Waiting until user replies
  });
}

/**
 * Helper to update mission document
 */
async function updateMissionStatus(missionId, status, extraData = {}) {
  await db.collection(COLLECTIONS.MISSIONS).doc(missionId).update({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extraData
  });
}

/**
 * Helper to add a log entry to the logs sub-collection
 */
async function streamLog(missionId, type, content) {
  try {
    await db.collection(COLLECTIONS.MISSIONS).doc(missionId).collection('logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      content
    });
  } catch (error) {
    console.error('Error writing log to Firestore:', error);
  }
}

/**
 * Helper to add an agent comment to the comments sub-collection
 */
async function streamComment(missionId, role, content) {
  try {
    await db.collection(COLLECTIONS.MISSIONS).doc(missionId).collection('comments').add({
      role,
      authorName: 'Agent',
      content,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error writing comment to Firestore:', error);
  }
}
