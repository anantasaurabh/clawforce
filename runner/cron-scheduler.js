import admin from 'firebase-admin';
import axios from 'axios';
import dotenv from 'dotenv';
import { COLLECTIONS, getUserAuthsPath, getUserConfigPath } from './constants.js';

import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultServiceAccountPath = path.join(__dirname, 'service-account.json');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || defaultServiceAccountPath;

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
    
    // 1. Fetch all approved posts (Filter scheduledAt in memory to avoid index requirement)
    const postsRef = db.collection(COLLECTIONS.PENDING_POSTS);
    const q = postsRef.where('status', '==', 'approved');
    
    const snap = await q.get();
    
    if (snap.empty) {
      console.log('✅ No pending approved posts found for this cycle.');
      process.exit(0);
    }

    // Filter by date in memory
    const readyPosts = snap.docs.filter(doc => {
      const data = doc.data();
      return data.scheduledAt && data.scheduledAt.toDate() <= now;
    });

    if (readyPosts.length === 0) {
      console.log('⏳ Approved posts exist, but none are due for publication yet.');
      process.exit(0);
    }

    console.log(`🚀 Found ${readyPosts.length} posts ready for publication.`);

    for (const doc of readyPosts) {
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

        // 2.1 Fetch Global Shared Parameters (Single Source of Truth)
        const userConfigPath = getUserConfigPath(post.ownerId);
        const userConfigSnap = await db.doc(userConfigPath).get();
        const userConfig = userConfigSnap.exists ? userConfigSnap.data() : {};
        const sharedParameters = userConfig.sharedParameters || {};

        // Merge shared parameters into auths (uppercase for consistency)
        for (const [key, value] of Object.entries(sharedParameters)) {
          auths[key.toUpperCase()] = value;
        }

        // 3. Delegate to specific publisher based on agentId
        let result;
        switch (post.agentId) {
          case 'linkedin-manager':
            result = await publishToLinkedIn({ ...post, id: postId }, auths);
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
  // If targetUrn is present and looks like an organization, treat as community
  const isOrgUrn = post.targetUrn && (post.targetUrn.includes('organization') || post.targetUrn.includes('organizationBrand'));
  const target = post.target || (isOrgUrn ? 'community' : 'personal');
  
  let token;
  let urn;

  if (target === 'personal') {
    // Prioritize Social Token as it's generally more reliable for posting
    token = auths.LINKEDIN_SOCIAL_TOKEN || auths.LINKEDIN_PERSONAL_TOKEN;
    
    // Use targetUrn if explicitly provided, otherwise resolve from auths
    urn = post.targetUrn || (auths.LINKEDIN_SOCIAL_TOKEN 
      ? (auths.LINKEDIN_SOCIAL_PERSONAL_URN || auths.LINKEDIN_SOCIAL_URN || auths.LINKEDIN_PERSONAL_URN)
      : (auths.LINKEDIN_PERSONAL_URN || auths.LINKEDIN_SOCIAL_URN));
  } else {
    // Community/Organization Target
    token = auths.LINKEDIN_SOCIAL_TOKEN || auths.LINKEDIN_COMMUNITY_TOKEN || auths.LINKEDIN_PERSONAL_TOKEN;
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
  }

    // Resolve full URN (Preserve prefix if present)
    const mediaOwnerUrn = urn && typeof urn === 'string' && urn.includes(':') 
      ? urn 
      : (target === 'personal' ? `urn:li:person:${urn}` : `urn:li:organization:${urn}`);

    let authorUrn = mediaOwnerUrn;

    // Normalize: LinkedIn /v2/posts API requires 'urn:li:organization' even for brand pages
    if (authorUrn.includes('organizationBrand')) {
      console.log(`[Post ${post.id}] Normalizing brand URN to organization URN for Posts API author field`);
      authorUrn = authorUrn.replace('organizationBrand', 'organization');
    }

    if (!token || !urn) {
      throw new Error(`Missing credentials for LinkedIn ${target} publication.`);
    }

    // Native Media Upload Logic
    let assetUrn = null;
    let isPdf = false;

    if (post.mediaUrl) {
      try {
        console.log(`[Post ${post.id}] Attempting native media upload for: ${post.mediaUrl}`);
        
        // 1. Download Media
        const mediaRes = await axios.get(post.mediaUrl, { responseType: 'arraybuffer' });
        const contentType = mediaRes.headers['content-type'] || 'application/octet-stream';
        
        const isVideo = contentType.includes('video');
        isPdf = contentType.includes('pdf') || post.mediaUrl.toLowerCase().endsWith('.pdf');
        
        // 2. Register Upload
        let recipe = "urn:li:digitalmediaRecipe:feedshare-image";
        if (isVideo) recipe = "urn:li:digitalmediaRecipe:feedshare-video";
        if (isPdf) recipe = "urn:li:digitalmediaRecipe:feedshare-document";

        const registerRes = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
          registerUploadRequest: {
            recipes: [recipe],
            owner: mediaOwnerUrn,
            serviceRelationships: [{
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent"
            }]
          }
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        const uploadUrl = registerRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        assetUrn = registerRes.data.value.asset;

        // 3. Upload Binary
        await axios.put(uploadUrl, mediaRes.data, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': contentType
          }
        });

        console.log(`[Post ${post.id}] Native upload successful: ${assetUrn} (${recipe})`);
      } catch (uploadErr) {
        console.error(`[Post ${post.id}] Native upload failed, falling back to text-only:`, uploadErr.response?.data || uploadErr.message);
      }
    }

    // Use the stable /v2/ugcPosts API (more robust for organization brand pages)
    const ugcPostData = {
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: {
                    text: post.content
                },
                shareMediaCategory: assetUrn ? (isPdf ? "NONE" : (post.mediaUrl.toLowerCase().includes('video') ? "VIDEO" : "IMAGE")) : "NONE",
                media: assetUrn ? [{
                    status: "READY",
                    media: assetUrn,
                    title: {
                        text: isPdf ? (post.mediaTitle || "Shared Document") : (post.mediaTitle || "Shared Image")
                    }
                }] : []
            }
        },
        visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    };

    // Special handling for documents/PDFs which aren't natively supported as 'IMAGE' in ugcPosts
    // In that case, we might need to use a different category or fallback
    if (isPdf) {
      ugcPostData.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "NONE";
      delete ugcPostData.specificContent["com.linkedin.ugc.ShareContent"].media;
      // Note: Truly native document upload is only in /v2/posts, 
      // so for PDFs we append the link if ugcPosts is used, or we keep trying /v2/posts logic
    }

  try {
    const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', ugcPostData, {
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
      const errorData = response.data;
      const errorMessage = errorData.message || JSON.stringify(errorData);
      throw new Error(`LinkedIn API returned status ${response.status}: ${errorMessage}`);
    }
  } catch (err) {
    if (err.response) {
      console.error(`[Post ${post.id}] LinkedIn UGC API Error Detail:`, JSON.stringify(err.response.data, null, 2));
      throw new Error(`LinkedIn UGC API Error: ${err.response.status} - ${err.response.data.message || JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

// Start execution
runScheduler();
