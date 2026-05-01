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
            result = await publishToFacebook({ ...post, id: postId }, auths);
            break;
          case 'instagram-manager':
            result = await publishToInstagram({ ...post, id: postId }, auths);
            break;
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

/**
 * Publisher: Facebook
 */
async function publishToFacebook(post, auths) {
  const token = auths.FACEBOOK_TOKEN || auths.FACEBOOK_ACCESS_TOKEN;
  const pageId = post.targetUrn || auths.FACEBOOK_PAGE_ID;

  if (!token) throw new Error('Missing FACEBOOK_TOKEN for authorization.');
  if (!pageId) throw new Error('Missing target Facebook Page ID.');

  console.log(`[Facebook] Posting to page ${pageId}...`);

  let finalToken = token;
  
  // Try to find the page-specific token in FACEBOOK_PAGE_LIST if we have it
  if (auths.FACEBOOK_PAGE_LIST) {
    try {
      const pages = JSON.parse(auths.FACEBOOK_PAGE_LIST);
      const match = pages.find(p => p.id === pageId);
      if (match && match.token) {
        finalToken = match.token;
        console.log(`[Facebook] Using cached Page Access Token for ${pageId}`);
      }
    } catch (e) {
      console.warn(`[Facebook] Failed to parse FACEBOOK_PAGE_LIST:`, e.message);
    }
  }

  // If we haven't found a page token yet, or if we want to ensure we have the latest, 
  // try to fetch it using the user token (only if finalToken is still the user token)
  if (finalToken === token) {
    try {
      const pageRes = await axios.get(`https://graph.facebook.com/v19.0/${pageId}`, {
        params: {
          fields: 'access_token',
          access_token: token
        }
      });
      if (pageRes.data && pageRes.data.access_token) {
        finalToken = pageRes.data.access_token;
        console.log(`[Facebook] Retrieved Page Access Token for ${pageId} via API`);
      }
    } catch (e) {
      console.warn(`[Facebook] Failed to get page token via API, using user token:`, e.message);
    }
  }

  let url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const params = {
    message: post.content,
    access_token: finalToken
  };

  if (post.mediaUrl) {
    const isVideo = post.mediaUrl.toLowerCase().includes('mp4') || post.mediaUrl.toLowerCase().includes('video');
    if (isVideo) {
      url = `https://graph.facebook.com/v19.0/${pageId}/videos`;
      params.description = post.content;
      params.file_url = post.mediaUrl;
    } else {
      url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
      params.caption = post.content;
      params.url = post.mediaUrl;
    }
  }

  const res = await axios.post(url, null, { params });
  const resultId = res.data.id || res.data.post_id;

  return {
    success: true,
    id: resultId,
    link: `https://facebook.com/${resultId}`
  };
}

/**
 * Publisher: Instagram
 */
async function publishToInstagram(post, auths) {
  const token = auths.INSTAGRAM_TOKEN || auths.INSTAGRAM_ACCESS_TOKEN || auths.FACEBOOK_TOKEN || auths.FACEBOOK_ACCESS_TOKEN; 
  const igUserId = post.targetUrn || auths.INSTAGRAM_USER_ID;

  if (!token) throw new Error('Missing access token for Instagram/Facebook graph.');
  if (!igUserId) throw new Error('Missing target Instagram Business Account ID.');

  if (!post.mediaUrl) {
    throw new Error('Instagram requires an image or video media URL. Text-only posting is not supported.');
  }

  console.log(`[Instagram] Creating media container for ${igUserId}...`);
  const isVideo = post.mediaUrl.toLowerCase().includes('mp4') || post.mediaUrl.toLowerCase().includes('video');

  const containerRes = await axios.post(`https://graph.facebook.com/v19.0/${igUserId}/media`, null, {
    params: {
      caption: post.content,
      access_token: token,
      [isVideo ? 'video_url' : 'image_url']: post.mediaUrl,
      media_type: isVideo ? 'REELS' : 'IMAGE'
    }
  });

  const creationId = containerRes.data.id;
  if (!creationId) throw new Error('Failed to create Instagram media container.');

  console.log(`[Instagram] Container created: ${creationId}. Waiting for processing...`);

  if (isVideo) {
     let attempts = 0;
     let status = 'IN_PROGRESS';
     while (attempts < 10 && status !== 'FINISHED') {
         await new Promise(resolve => setTimeout(resolve, 5000));
         attempts++;
         const statusRes = await axios.get(`https://graph.facebook.com/v19.0/${creationId}`, {
             params: { fields: 'status_code', access_token: token }
         });
         status = statusRes.data.status_code;
         console.log(`[Instagram] Container status: ${status}`);
         if (status === 'ERROR') throw new Error('Instagram video processing error.');
     }
  }

  console.log(`[Instagram] Publishing container...`);
  const publishRes = await axios.post(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, null, {
    params: {
      creation_id: creationId,
      access_token: token
    }
  });

  return {
    success: true,
    id: publishRes.data.id,
    link: `https://instagram.com/p/${publishRes.data.id}`
  };
}

// Start execution
runScheduler();
