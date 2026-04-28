import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { COLLECTIONS, getUserConfigPath, getUserAuthsPath } from './constants.js';
import { PROVIDERS, PERFORMANCE } from './providers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: process.env.GCLOUD_PROJECT
});

const db = admin.firestore();

/**
 * Generic OAuth Initialization Endpoint
 * Redirects user to the provider's consent screen.
 */
app.get('/auth/:provider', (req, res) => {
  const { provider } = req.params;
  const { state } = req.query;

  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(404).send(`Provider ${provider} not supported`);
  }

  const backendBase = process.env.BACKEND_URL || 'https://dev-backend-clawforce.altovation.in';
  const redirect_uri = `${backendBase}/auth/${provider}/callback`;
  const clientId = process.env[providerConfig.clientIdEnv];

  if (!clientId) {
    return res.status(500).send(`Server is missing client ID for ${provider}`);
  }

  const authUrl = new URL(providerConfig.authUrl);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirect_uri);
  authUrl.searchParams.append('state', state || '');
  if (providerConfig.scopes) {
    authUrl.searchParams.append('scope', providerConfig.scopes);
  }

  res.redirect(authUrl.toString());
});

/**
 * Generic OAuth Callback Handler
 * Supports any provider defined in providers.js
 */
app.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state, error, error_description, error_message, error_code } = req.query;

  const localProviderLogic = PROVIDERS[provider] || {};

  // Helper to decode state safely
  const getContext = (stateStr) => {
    try {
      return stateStr ? JSON.parse(Buffer.from(stateStr, 'base64').toString()) : {};
    } catch {
      return {};
    }
  };

  const { userId, agentId } = getContext(state);
  const redirectBase = (agentId && agentId !== 'settings') 
    ? `${process.env.HQ_FRONTEND_URL}/agent/${agentId}` 
    : `${process.env.HQ_FRONTEND_URL}/settings`;

  const actualError = error || error_message || error_code;
  const actualErrorDesc = error_description || error_message || `Auth error code ${error_code}`;

  if (actualError) {
    console.error(`[${provider}] Auth Error:`, actualError, actualErrorDesc);
    return res.redirect(`${redirectBase}?auth_status=error&message=${encodeURIComponent(actualErrorDesc)}`);
  }

  if (!code || !state) {
    return res.redirect(`${redirectBase}?auth_status=error&message=${encodeURIComponent('Missing code or state from provider')}`);
  }

  try {
    if (!userId || !agentId) {
      throw new Error('Invalid state parameters');
    }

    if (!localProviderLogic.tokenUrl) {
      return res.status(404).send(`Provider ${provider} not supported`);
    }

    const clientId = process.env[localProviderLogic.clientIdEnv];
    const clientSecret = process.env[localProviderLogic.clientSecretEnv];

    if (!clientId || !clientSecret) {
      throw new Error(`Server is missing credentials for ${provider}`);
    }

    // 2. Exchange Code for Access Token
    const backendBase = process.env.BACKEND_URL || 'https://dev-backend-clawforce.altovation.in';
    const redirect_uri = `${backendBase}/auth/${provider}/callback`;

    const tokenResponse = await axios.post(localProviderLogic.tokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // 3. Update User's Global Authorizations in Firestore
    let credentials = localProviderLogic.fieldMap 
      ? localProviderLogic.fieldMap(tokenResponse.data)
      : { 
          access_token: tokenResponse.data.access_token, 
          [`${provider}_expires_at`]: Date.now() + (tokenResponse.data.expires_in * 1000),
          token_expires_at: Date.now() + (tokenResponse.data.expires_in * 1000)
        };
    
    // Optional additional fetch (e.g. for LinkedIn URN)
    if (localProviderLogic.postAuthFetch) {
      try {
        console.log(`[OAuth] Executing postAuthFetch for ${provider}`);
        const extraData = await localProviderLogic.postAuthFetch(tokenResponse.data.access_token, axios);
        credentials = { ...credentials, ...extraData };
      } catch (postErr) {
        console.error(`[OAuth] postAuthFetch failed for ${provider}:`, postErr.message);
        // We continue anyway so we don't lose the token itself
      }
    }

    const authPath = getUserAuthsPath(userId);
    const authRef = db.collection(authPath).doc(provider);

    await authRef.set({
      credentials,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      authMetadata: {
        provider,
        lastAuth: Date.now()
      }
    }, { merge: true });

    console.log(`[OAuth] Successfully authorized ${provider} for user ${userId}, agent ${agentId}`);

    // 4. Redirect user back to HQ
    res.redirect(`${redirectBase}?auth_status=success&provider=${provider}`);

  } catch (err) {
    console.error(`[OAuth] Exchange Failure:`, err.response?.data || err.message);
    const errorMsg = err.response?.data?.error_description || err.message || 'Token exchange failed';
    res.redirect(`${redirectBase}?auth_status=error&message=${encodeURIComponent(errorMsg)}`);
  }
});


/**
 * Helper to normalize agentId from URL (e.g. 'linkedin' -> 'linkedin-manager')
 */
const normalizeAgentId = (id) => {
  const map = {
    'linkedin': 'linkedin-manager',
    'facebook': 'facebook-manager',
    'instagram': 'instagram-manager',
    'email': 'email-manager'
  };
  return map[id] || id;
};

/**
 * Token Validation Middleware
 */
const validateReviewToken = async (req, res, next) => {
  const { userId, token } = { ...req.query, ...req.body };
  let agentId = req.params.agentId || req.query.agentId || req.body.agentId;
  
  console.log(`[Auth Check] User: ${userId}, Agent: ${agentId}, Token: ${token ? token.substring(0, 4) + '...' : 'MISSING'}`);

  if (!userId || !token) {
    console.warn('[Auth Check] Missing userId or token');
    return res.status(400).send('Missing userId or token');
  }

  try {
    // 1. Check Global Token first
    const userRef = db.collection(`artifacts/clwhq-001/userConfigs`).doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data().globalReviewToken === token) {
      console.log(`[Auth Check] Success: Global token matched for ${userId}`);
      return next();
    }

    // 2. Check Agent-specific Token
    if (agentId) {
      agentId = normalizeAgentId(agentId);
      const configPath = getUserConfigPath(userId);
      const configRef = db.collection(configPath).doc(agentId);
      const configSnap = await configRef.get();
      
      if (configSnap.exists && configSnap.data().reviewSecretToken === token) {
        console.log(`[Auth Check] Success: Agent token matched for ${agentId}`);
        return next();
      } else {
        console.log(`[Auth Check] Agent token mismatch for ${agentId}. Expected: ${configSnap.exists ? configSnap.data().reviewSecretToken : 'NOT_FOUND'}`);
      }
    }

    // 3. Last Resort: Check if token matches ANY agent
    const configPath = getUserConfigPath(userId);
    const agentsSnap = await db.collection(configPath).get();
    const match = agentsSnap.docs.find(doc => doc.data().reviewSecretToken === token);
    if (match) {
      console.log(`[Auth Check] Success: Token matched other agent ${match.id}`);
      return next();
    }

    console.warn(`[Auth Check] FINAL FAILURE for user ${userId} on agent ${agentId}`);
    res.status(403).send('Unauthorized: Invalid secret token');
  } catch (err) {
    console.error('[Auth Check] Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
};



/**
 * Centralized Review Dashboard
 */
app.get('/review', validateReviewToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

/**
 * Agent-Specific Review Interface
 */
app.get('/review/:agentId', validateReviewToken, (req, res) => {
  const { agentId } = req.params;
  const viewMap = {
    'linkedin-manager': 'linkedin.html',
    'facebook-manager': 'facebook.html',
    'instagram-manager': 'instagram.html'
  };

  const viewFile = viewMap[agentId] || 'generic_review.html';
  const filePath = path.join(__dirname, 'views', viewFile);
  
  // Fallback to linkedin.html if specific view doesn't exist yet (for testing)
  res.sendFile(filePath, (err) => {
    if (err) res.sendFile(path.join(__dirname, 'views', 'linkedin.html'));
  });
});

/**
 * API: Get Review Statistics (Pending Counts)
 */
app.get('/api/review/stats', validateReviewToken, async (req, res) => {
  const { userId } = req.query;
  
  try {
    const postsRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`);
    const q = postsRef.where('ownerId', '==', userId).where('status', '==', 'pending');
    const snap = await q.get();

    const stats = {};
    snap.docs.forEach(doc => {
      const agentId = doc.data().agentId;
      stats[agentId] = (stats[agentId] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * LinkedIn Post Review Interface (Legacy Route - Redirecting)
 */
app.get('/linkedin-manager/review', (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  res.redirect(`/review/linkedin-manager?${query}`);
});

/**
 * Get Pending Posts for Review
 */
app.get('/api/:agentId/posts', validateReviewToken, async (req, res) => {
  const { userId } = req.query;
  const agentId = normalizeAgentId(req.params.agentId);

  try {
    const postsRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`);
    let q = postsRef.where('agentId', '==', agentId).where('ownerId', '==', userId);
    
    const statusFilter = req.query.status;
    if (statusFilter && statusFilter !== 'all') {
      q = q.where('status', '==', statusFilter);
    } else if (!statusFilter) {
      q = q.where('status', '==', 'pending');
    }

    const snap = await q.get();
    const posts = snap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        scheduledAt: data.scheduledAt ? data.scheduledAt.toDate().toISOString() : null
      };
    });
    res.json(posts);
  } catch (err) {
    console.error('[GetPosts] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Post Approval Endpoint
 */
app.post('/api/:agentId/approve', validateReviewToken, async (req, res) => {
  const { userId, postId, action = 'approve' } = req.body;
  const agentId = normalizeAgentId(req.params.agentId);

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' });
  }

  try {
    // Update Post Status (with ownership verification)
    const postRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`).doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists || postSnap.data().ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: Post does not belong to you' });
    }

    let finalStatus;
    if (action === 'approve') finalStatus = 'approved';
    else if (action === 'pending') finalStatus = 'pending';
    else finalStatus = 'rejected';

    await postRef.update({
      status: finalStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, status: finalStatus });
  } catch (err) {
    console.error('[Approve] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete Post Endpoint
 */
app.post('/api/:agentId/delete', validateReviewToken, async (req, res) => {
  const { userId, postId } = req.body;
  const agentId = normalizeAgentId(req.params.agentId);

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' });
  }

  try {
    const postRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`).doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists || postSnap.data().ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: Post does not belong to you' });
    }

    await postRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Batch Delete Posts
 */
app.post('/api/:agentId/batch-delete', validateReviewToken, async (req, res) => {
  const { userId, postIds } = req.body;
  const agentId = normalizeAgentId(req.params.agentId);

  if (!Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({ error: 'Missing postIds array' });
  }

  try {
    const postsRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`);
    const batch = db.batch();
    let count = 0;

    // We fetch to verify ownership for each post
    const snapshots = await Promise.all(postIds.map(id => postsRef.doc(id).get()));
    
    snapshots.forEach(snap => {
      if (snap.exists && snap.data().ownerId === userId) {
        batch.delete(snap.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    res.json({ success: true, count });
  } catch (err) {
    console.error('[BatchDelete] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Update Post Data (Content, Media, Schedule)
 */
app.post('/api/:agentId/update', validateReviewToken, async (req, res) => {
  const { userId, postId, content, mediaUrl, scheduledAt } = req.body;
  const agentId = normalizeAgentId(req.params.agentId);

  if (!postId) {
    return res.status(400).json({ error: 'Missing postId' });
  }

  try {
    const postRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`).doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists || postSnap.data().ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: Post does not belong to you' });
    }

    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (content !== undefined) updateData.content = content;
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
    if (scheduledAt !== undefined) {
      updateData.scheduledAt = scheduledAt ? admin.firestore.Timestamp.fromDate(new Date(scheduledAt)) : null;
    }

    await postRef.update(updateData);
    res.json({ success: true });
  } catch (err) {
    console.error('[UpdatePost] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Create New Post
 */
app.post('/api/:agentId/create', validateReviewToken, async (req, res) => {
  const { userId, content, mediaUrl, scheduledAt } = req.body;
  const agentId = normalizeAgentId(req.params.agentId);

  if (!content) {
    return res.status(400).json({ error: 'Missing content' });
  }

  try {
    const postsRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`);
    const newPost = {
      agentId,
      ownerId: userId,
      content,
      mediaUrl: mediaUrl || null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (scheduledAt) {
      newPost.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(scheduledAt));
    }

    const docRef = await postsRef.add(newPost);
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('[CreatePost] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Batch Create New Posts
 */
app.post('/api/posts/batch-create', validateReviewToken, async (req, res) => {
  const { userId, posts } = req.body;

  if (!userId || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({ error: 'Missing userId or posts array' });
  }

  try {
    const postsRef = db.collection(`artifacts/clwhq-001/public/data/pending_posts`);
    const batch = db.batch();
    const createdIds = [];

    posts.forEach(post => {
      const newPostRef = postsRef.doc();
      const postData = {
        agentId: post.agentId || 'linkedin-manager',
        ownerId: userId,
        content: post.content,
        mediaUrl: post.mediaUrl || null,
        status: post.status || 'pending',
        targetUrn: post.targetUrn || null,
        targetName: post.targetName || null,
        targetPic: post.targetPic || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const scheduledAtVal = post.scheduledAt || post.scheduledFor;
      if (scheduledAtVal) {
        try {
          const date = new Date(scheduledAtVal);
          if (!isNaN(date.getTime())) {
            postData.scheduledAt = admin.firestore.Timestamp.fromDate(date);
          } else {
            console.warn(`[BatchCreate] Invalid date string received: ${scheduledAtVal}`);
          }
        } catch (e) {
          console.warn(`[BatchCreate] Error parsing date: ${scheduledAtVal}`, e.message);
        }
      }

      batch.set(newPostRef, postData);
      createdIds.push(newPostRef.id);
    });

    await batch.commit();

    res.json({ success: true, count: createdIds.length, ids: createdIds });
  } catch (err) {
    console.error('[BatchCreate] Failure:', err.message);
    res.status(500).json({ error: err.message });
  }
});
app.get('/metrics/:provider', async (req, res) => {
  const { provider } = req.params;
  const { timeRange, targetId } = req.query;

  try {
    const performanceLogic = PERFORMANCE[provider];
    if (!performanceLogic || !performanceLogic.fetchMetrics) {
      return res.status(404).json({ error: `Performance tracking not implemented for ${provider}` });
    }

    const metrics = await performanceLogic.fetchMetrics(timeRange, targetId);
    res.json(metrics);
  } catch (err) {
    console.error(`[Metrics] Error for ${provider}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📡 Multi-Provider OAuth Backend listening on port ${PORT}`);
});
