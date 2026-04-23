import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { COLLECTIONS, getUserAuthsPath } from './constants.js';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: process.env.GCLOUD_PROJECT
  });
}

const db = admin.firestore();

/**
 * Main Scheduler Loop
 */
async function runScheduler() {
  console.log(`[${new Date().toISOString()}] 🕒 Starting Cron Scheduler...`);
  
  try {
    const now = new Date();
    
    // 1. Fetch all approved posts scheduled for now or in the past
    const postsRef = db.collection(COLLECTIONS.PENDING_POSTS);
    const q = postsRef
      .where('status', '==', 'approved')
      .where('scheduledAt', '<=', admin.firestore.Timestamp.fromDate(now));
    
    const snap = await q.get();
    
    if (snap.empty) {
      console.log('✅ No pending approved posts found for this cycle.');
      process.exit(0);
    }

    console.log(`🚀 Found ${snap.size} posts ready for publication.`);

    for (const doc of snap.docs) {
      const post = doc.data();
      const postId = doc.id;
      
      console.log(`\n[Post ${postId}] Agent: ${post.agentId} | Owner: ${post.ownerId}`);
      
      try {
        // 2. Fetch User Authorizations (OAuth Tokens)
        const authsPath = getUserAuthsPath(post.ownerId);
        const authsSnap = await db.collection(authsPath).get();
        const auths = {};
        authsSnap.forEach(aDoc => {
          const data = aDoc.data();
          if (data.credentials) {
            for (const [key, value] of Object.entries(data.credentials)) {
              auths[key.toUpperCase()] = value;
            }
          }
        });

        // 3. Delegate to specific publisher based on agentId
        let result;
        switch (post.agentId) {
          case 'linkedin-manager':
            result = await publishToLinkedIn(post, auths);
            break;
          case 'facebook-manager':
            // Placeholder for future implementation
            throw new Error('Facebook publisher not yet implemented');
          default:
            throw new Error(`Publisher for agent type '${post.agentId}' not found.`);
        }

        // 4. Mark as completed
        await doc.ref.update({
          status: 'completed',
          publishedAt: admin.firestore.FieldValue.serverTimestamp(),
          externalLink: result.link || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✨ [Post ${postId}] Successfully published!`);
        if (result.link) console.log(`🔗 Link: ${result.link}`);

      } catch (postErr) {
        console.error(`❌ [Post ${postId}] Failed:`, postErr.message);
        
        await doc.ref.update({
          status: 'failed',
          lastError: postErr.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    console.log(`\n[${new Date().toISOString()}] Done. Cycle complete.`);
    process.exit(0);

  } catch (err) {
    console.error('FATAL ERROR in scheduler:', err);
    process.exit(1);
  }
}

/**
 * Publisher: LinkedIn
 */
async function publishToLinkedIn(post, auths) {
  // Determine Target (Default to personal if not specified in post metadata)
  const target = post.target || 'personal';
  
  let token = auths.LINKEDIN_PERSONAL_TOKEN;
  let urn = auths.LINKEDIN_PERSONAL_URN;

  if (target === 'personal') {
    token = auths.LINKEDIN_PERSONAL_TOKEN || auths.LINKEDIN_SOCIAL_TOKEN;
    urn = auths.LINKEDIN_PERSONAL_URN || auths.LINKEDIN_SOCIAL_URN;
  } else {
    // Community/Organization Target
    token = auths.LINKEDIN_COMMUNITY_TOKEN || auths.LINKEDIN_SOCIAL_TOKEN;
    urn = post.targetUrn || auths.LINKEDIN_COMMUNITY_URN;

    if (!urn && auths.LINKEDIN_PAGE_URN) {
      try {
        const pages = JSON.parse(auths.LINKEDIN_PAGE_URN);
        if (Array.isArray(pages) && pages.length > 0) {
          // Default to the first managed organization if none specified
          urn = pages[0].urn;
        }
      } catch (e) {
        console.error("Failed to parse LINKEDIN_PAGE_URN JSON in scheduler");
      }
    }

    // Clean prefix if present
    if (urn && typeof urn === 'string' && urn.startsWith('urn:li:organization:')) {
      urn = urn.replace('urn:li:organization:', '');
    }
  }

  if (!token || !urn || (typeof token === 'string' && token.includes('your_'))) {
    throw new Error(`Missing LinkedIn ${target} credentials (TOKEN/URN) for owner ${post.ownerId}`);
  }

  const postData = {
    author: target === 'personal' ? `urn:li:person:${urn}` : `urn:li:organization:${urn}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: post.content },
        shareMediaCategory: "NONE"
      }
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
  };

  // Support for media categories if mediaUrl is provided
  if (post.mediaUrl) {
    // Current simple implementation: append media URL to content if present
    // Proper LinkedIn media upload requires a multi-step handshake
    postData.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text += `\n\n${post.mediaUrl}`;
  }

  const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', postData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });

  if (response.status === 201 || response.status === 200) {
    const id = response.data.id;
    return {
      success: true,
      link: id ? `https://www.linkedin.com/feed/update/${id}` : null
    };
  } else {
    throw new Error(`LinkedIn API returned status ${response.status}: ${JSON.stringify(response.data)}`);
  }
}

// Start execution
runScheduler();
