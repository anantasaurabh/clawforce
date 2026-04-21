import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { COLLECTIONS, getUserConfigPath, getUserAuthsPath } from './constants.js';
import { PROVIDERS } from './providers.js';

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
 * Generic OAuth Callback Handler
 * Supports any provider defined in providers.js
 */
app.get('/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, state, error, error_description } = req.query;

  const providerConfig = PROVIDERS[provider];
  
  // Helper to decode state safely
  const getContext = (stateStr) => {
    try {
      return stateStr ? JSON.parse(Buffer.from(stateStr, 'base64').toString()) : {};
    } catch {
      return {};
    }
  };

  const { userId, agentId } = getContext(state);
  const redirectBase = agentId ? `${process.env.HQ_FRONTEND_URL}/agent/${agentId}` : `${process.env.HQ_FRONTEND_URL}/taskforce`;

  if (error) {
    console.error(`[${provider}] Auth Error:`, error, error_description);
    return res.redirect(`${redirectBase}?auth_status=error&message=${encodeURIComponent(error_description)}`);
  }

  if (!providerConfig) {
    return res.status(404).send(`Provider ${provider} not supported`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  try {
    if (!userId || !agentId) {
      throw new Error('Invalid state parameters');
    }

    // 2. Exchange Code for Access Token
    // Dynamic redirect URI construction to match the frontend EXACTLY
    const backendBase = process.env.BACKEND_URL || 'https://backend-clawforce.altovation.in';
    const redirect_uri = `${backendBase}/auth/${provider}/callback`;

    const tokenResponse = await axios.post(providerConfig.tokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        code,
        client_id: process.env[providerConfig.clientIdEnv],
        client_secret: process.env[providerConfig.clientSecretEnv],
        redirect_uri,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // 3. Update User's Global Authorizations in Firestore
    const credentials = providerConfig.fieldMap(tokenResponse.data);
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

    // 4. Redirect user back to Agent Details page in HQ
    res.redirect(`${redirectBase}?auth_status=success`);

  } catch (err) {
    console.error(`[${provider}] OAuth Exchange Failure:`, err.response?.data || err.message);
    const errorMsg = err.response?.data?.error_description || err.message || 'Token exchange failed';
    res.redirect(`${redirectBase}?auth_status=error&message=${encodeURIComponent(errorMsg)}`);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📡 Multi-Provider OAuth Backend listening on port ${PORT}`);
});
