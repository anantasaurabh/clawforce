const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const APP_ID = 'clwhq-001';

async function migrateUser(userId) {
  console.log(`Migrating user: ${userId}`);
  
  // 1. Get all agent settings for this user
  const settingsRef = db.collection(`artifacts/${APP_ID}/userConfigs/${userId}/agentSettings`);
  const snapshot = await settingsRef.get();
  
  const sharedParams = {};
  
  // 2. Collect all credentials and prepare for deletion
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.credentials) {
      console.log(`  Found credentials in agent: ${doc.id}`);
      Object.assign(sharedParams, data.credentials);
      
      // Remove credentials from agent doc
      await doc.ref.update({
        credentials: admin.firestore.FieldValue.delete()
      });
    }
  }
  
  // 3. Save to global sharedParameters
  if (Object.keys(sharedParams).length > 0) {
    console.log(`  Saving ${Object.keys(sharedParams).length} shared parameters...`);
    const userRef = db.doc(`artifacts/${APP_ID}/userConfigs/${userId}`);
    await userRef.set({
      sharedParameters: sharedParams,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  
  console.log(`Finished migrating ${userId}`);
}

async function run() {
  // Add user IDs to migrate here
  const users = ['sXz6pWlv15Wsvt08mUP8y7nbdk83', 'tl5giVf2mbaIcsFf1AC4lCi3kOi1'];
  for (const u of users) {
    await migrateUser(u);
  }
  process.exit(0);
}

run().catch(console.error);
