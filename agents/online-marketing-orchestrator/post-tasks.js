import fs from 'fs';
import admin from 'firebase-admin';

// 1. Read input from OpenClaw (JSON over Stdin)
const rawInput = fs.readFileSync(0, 'utf8');

if (!rawInput) {
    console.log(JSON.stringify({ status: "error", message: "No input received from OpenClaw." }));
    process.exit(1);
}

try {
    const data = JSON.parse(rawInput);
    const params = data.params || {};
    const env = data.context?.env || {};

    const tasks = params.tasks;
    const missionId = env.OPENCLAW_MISSION_ID || process.env.OPENCLAW_MISSION_ID;
    const userId = env.USER_ID || process.env.USER_ID;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        console.log(JSON.stringify({ status: "error", message: "No tasks provided." }));
        process.exit(1);
    }

    if (!missionId) {
        console.log(JSON.stringify({ status: "error", message: "Missing OPENCLAW_MISSION_ID in context." }));
        process.exit(1);
    }

    // 2. Initialize Firebase Admin
    const defaultServiceAccountPath = '/var/www/web/hq-clawforce.altovation.in/public_html/runner/service-account.json';
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
            projectId: process.env.GCLOUD_PROJECT
        });
    }

    const db = admin.firestore();
    const COLLECTIONS_TASKS = 'artifacts/clwhq-001/public/data/tasks';
    const COLLECTIONS_MISSIONS = 'artifacts/clwhq-001/public/data/missions';

    const tasksRef = db.collection(COLLECTIONS_TASKS);
    const createdTaskIds = [];

    for (const task of tasks) {
        const docRef = await tasksRef.add({
            title: task.title || `Execute Task`,
            description: task.description || '',
            agentId: task.agentId || 'system',
            ownerId: userId || 'system',
            status: 'enqueued',
            progress: 0,
            startTime: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
                parent_mission_id: missionId
            }
        });
        createdTaskIds.push(docRef.id);
    }

    // 3. Update mission record state to in-progress
    await db.collection(COLLECTIONS_MISSIONS).doc(missionId).update({
        tasksSpawned: true,
        status: 'In-Progress',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(JSON.stringify({
        status: "success",
        message: `Successfully spawned ${tasks.length} platform deployment tasks.`,
        taskIds: createdTaskIds
    }));

} catch (err) {
    console.log(JSON.stringify({ status: "error", message: "Failed to create tasks: " + err.message }));
    process.exit(1);
}
