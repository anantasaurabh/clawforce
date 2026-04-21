import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { COLLECTIONS } from './constants.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Firebase Admin ─────────────────────────────────────────────────────────
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  projectId: process.env.GCLOUD_PROJECT
});
const db = admin.firestore();

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();

// Security headers (relaxed CSP for inline styles/scripts on landing page)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://firebasestorage.googleapis.com", "https://www.google-analytics.com"],
    }
  }
}));

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for lead submission
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Static Files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// ─── API: Fetch Agents ─────────────────────────────────────────────────────
let agentsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/agents', async (req, res) => {
  try {
    const now = Date.now();
    if (agentsCache && (now - cacheTimestamp) < CACHE_TTL) {
      return res.json({ success: true, agents: agentsCache });
    }

    const [agentsSnap, categoriesSnap] = await Promise.all([
      db.collection(COLLECTIONS.AGENTS).get(),
      db.collection(COLLECTIONS.CATEGORIES).get()
    ]);

    const categories = {};
    categoriesSnap.forEach(doc => {
      categories[doc.id] = doc.data();
    });

    const agents = [];
    agentsSnap.forEach(doc => {
      const data = doc.data();
      agents.push({
        id: doc.id,
        name: data.name || 'Unnamed Agent',
        description: data.description || '',
        category: data.category || 'general',
        categoryLabel: categories[data.category]?.label || data.category || 'General',
        imageUrl: data.imageUrl || null,
        status: data.status || 'active',
      });
    });

    agentsCache = agents;
    cacheTimestamp = now;

    res.json({ success: true, agents });
  } catch (err) {
    console.error('[API] Error fetching agents:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load agents.' });
  }
});

// ─── API: Submit Lead ───────────────────────────────────────────────────────
const LEADS_FILE = path.join(__dirname, 'leads.txt');

// Ensure leads file exists
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, '# ClawForce Early Preview Leads\n# Format: timestamp | name | email | company | message\n# ──────────────────────────────────────────────────────\n', 'utf-8');
}

app.post('/api/leads', leadLimiter, async (req, res) => {
  try {
    const { name, email, company, message } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Sanitize inputs
    const sanitize = (str) => (str || '').replace(/[|]/g, '-').replace(/[\r\n]/g, ' ').trim();
    const timestamp = new Date().toISOString();
    const line = `${timestamp} | ${sanitize(name)} | ${sanitize(email)} | ${sanitize(company)} | ${sanitize(message)}\n`;

    // Append to file
    fs.appendFileSync(LEADS_FILE, line, 'utf-8');

    console.log(`[Lead] New signup: ${email} (${name})`);

    res.json({ success: true, message: 'Thank you! You\'ve been added to the early preview list.' });
  } catch (err) {
    console.error('[Lead] Error saving lead:', err.message);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// ─── Sitemap ────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const siteUrl = process.env.SITE_URL || 'https://dev-clawforce.altovation.in';
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(sitemap);
});

// ─── robots.txt ─────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  const siteUrl = process.env.SITE_URL || 'https://dev-clawforce.altovation.in';
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml`);
});

// ─── SPA Fallback ───────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5160;
app.listen(PORT, () => {
  console.log(`🐾 ClawForce Landing Page running on port ${PORT}`);
  console.log(`📁 Leads file: ${LEADS_FILE}`);
});
