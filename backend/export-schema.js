import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (using the same logic as backend/index.js)
const serviceAccountPath = './service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Missing service-account.json in current directory');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

const APP_ID = 'clwhq-001';
const ROOT = `artifacts/${APP_ID}`;

const COLLECTIONS_TO_EXPORT = [
    `${ROOT}/public/data/users`,
    `${ROOT}/public/data/agents`,
    `${ROOT}/public/data/packages`,
    `${ROOT}/public/data/categories`,
    `${ROOT}/public/data/missions`,
    `${ROOT}/public/data/tasks`,
    `${ROOT}/public/data/silent_tasks`,
    `${ROOT}/public/data/pending_posts`,
    `${ROOT}/public/data/global_vars`,
    `${ROOT}/userConfigs`,
    `${ROOT}/userAuthorizations`
];

async function exportSchema() {
    const timestamp = new Date().toISOString();
    let markdown = `# Firestore Schema Export\n\n`;
    markdown += `**Exported At:** ${timestamp}\n\n`;
    markdown += `This document provides a snapshot of the Firestore structure based on the current database state.\n\n`;

    let sampleUserId = null;

    for (const collPath of COLLECTIONS_TO_EXPORT) {
        console.log(`Processing ${collPath}...`);
        markdown += `## Collection: \`${collPath}\`\n\n`;
        
        try {
            const snap = await db.collection(collPath).limit(1).get();
            if (snap.empty) {
                markdown += `*No documents found in this collection.*\n\n`;
            } else {
                const doc = snap.docs[0];
                const data = doc.data();
                
                // Keep track of a user ID to check subcollections later
                if (collPath.endsWith('userConfigs') || collPath.endsWith('users')) {
                    sampleUserId = doc.id;
                }

                markdown += `**Sample Document ID:** \`${doc.id}\`\n\n`;
                markdown += `**Fields:**\n\n`;
                markdown += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\n`;
                
                // Deep dive into user subcollections if applicable
                if (collPath.endsWith('userConfigs') && sampleUserId) {
                    const settingsPath = `${collPath}/${sampleUserId}/agentSettings`;
                    console.log(`  Checking subcollection: ${settingsPath}...`);
                    const settingsSnap = await db.collection(settingsPath).limit(1).get();
                    if (!settingsSnap.empty) {
                        markdown += `### Subcollection: \`agentSettings\` (Sample for User \`${sampleUserId}\`)\n\n`;
                        markdown += `**Sample Agent ID:** \`${settingsSnap.docs[0].id}\`\n\n`;
                        markdown += `\`\`\`json\n${JSON.stringify(settingsSnap.docs[0].data(), null, 2)}\n\`\`\`\n\n`;
                    }
                }

                if (collPath.endsWith('userAuthorizations') && sampleUserId) {
                    const providersPath = `${collPath}/${sampleUserId}/providers`;
                    console.log(`  Checking subcollection: ${providersPath}...`);
                    const providersSnap = await db.collection(providersPath).limit(1).get();
                    if (!providersSnap.empty) {
                        markdown += `### Subcollection: \`providers\` (Sample for User \`${sampleUserId}\`)\n\n`;
                        markdown += `**Sample Provider:** \`${providersSnap.docs[0].id}\`\n\n`;
                        markdown += `\`\`\`json\n${JSON.stringify(providersSnap.docs[0].data(), null, 2)}\n\`\`\`\n\n`;
                    }
                }
            }
        } catch (err) {
            markdown += `*Error fetching collection:* ${err.message}\n\n`;
        }
        
        markdown += `---\n\n`;
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `firestore-snapshot-${dateStr}.md`;
    const outputPath = path.join(__dirname, '..', 'docs', filename);
    
    fs.writeFileSync(outputPath, markdown);
    console.log(`Export completed: ${outputPath}`);
    return filename;
}

exportSchema()
    .then((filename) => {
        console.log(`Done! Created ${filename}`);
        process.exit(0);
    })
    .catch((err) => {
        console.error('Export failed:', err);
        process.exit(1);
    });
