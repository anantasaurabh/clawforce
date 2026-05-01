import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync('./backend/service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node check_tokens.js <userId>');
  process.exit(1);
}

async function check() {
  const docPath = `artifacts/clwhq-001/userConfigs/${userId}`;
  const snap = await db.doc(docPath).get();
  
  if (snap.exists) {
    console.log(`Document ${docPath} exists.`);
    console.log('Data:', JSON.stringify(snap.data(), null, 2));
  } else {
    console.log(`Document ${docPath} DOES NOT EXIST.`);
  }
  process.exit(0);
}

check();
