import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { getUserConfigPath } from '../backend/constants.js';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: process.env.GCLOUD_PROJECT
});

const db = admin.firestore();

async function checkToken() {
  const userId = 'tl5giVf2mbaIcsFf1AC4lCi3kOi1';
  const providedToken = 'rmkstr3rbxv03egnn28sq';
  const agentId = 'linkedin-manager';

  console.log(`Checking token for User: ${userId}`);
  
  // Check Global Token
  const userRef = db.collection(`artifacts/clwhq-001/userConfigs`).doc(userId);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    console.log(`Global Token found: ${userSnap.data().globalReviewToken}`);
  } else {
    console.log('User root config not found');
  }

  // Check Agent Token
  const configPath = getUserConfigPath(userId);
  const configRef = db.collection(configPath).doc(agentId);
  const configSnap = await configRef.get();
  if (configSnap.exists) {
    console.log(`Agent (${agentId}) Token found: ${configSnap.data().reviewSecretToken}`);
  } else {
    console.log(`Agent config for ${agentId} not found at ${configPath}`);
  }
}

checkToken().then(() => process.exit());
