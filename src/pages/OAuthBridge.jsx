import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

const PROVIDER_CONFIGS = {
  linkedin_personal: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    clientId: import.meta.env.VITE_LINKEDIN_PERSONAL_CLIENT_ID,
    scope: 'openid profile email w_member_social'
  },
  linkedin_social: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    clientId: import.meta.env.VITE_LINKEDIN_SOCIAL_CLIENT_ID,
    scope: 'w_member_social r_basicprofile w_organization_social r_organization_social rw_organization_admin w_member_social_feed w_organization_social_feed r_organization_social_feed'
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    clientId: import.meta.env.VITE_FACEBOOK_CLIENT_ID,
    scope: 'public_profile,email'
  }
};

export default function OAuthBridge() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const agentId = searchParams.get('agentId');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser || !agentId) return;

    const config = PROVIDER_CONFIGS[provider];

    if (!config) {
      setError(`Unsupported provider: "${provider}"`);
      return;
    }

    if (!config.clientId) {
      setError(`Client ID for "${provider}" is missing in .env (VITE_LINKEDIN_PERSONAL_CLIENT_ID etc.)`);
      return;
    }

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://dev-backend-clawforce.altovation.in';
      const redirectUri = encodeURIComponent(`${backendUrl}/auth/${provider}/callback`);
      const state = btoa(JSON.stringify({ userId: currentUser.uid, agentId }));

      const authUrl = `${config.authUrl}?response_type=code&client_id=${config.clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${encodeURIComponent(config.scope)}`;

      console.log(`[OAuth] Redirecting to: ${authUrl}`);
      window.location.href = authUrl;
    } catch (err) {
      console.error('[OAuth] Bridge Error:', err);
      setError(`Failed to generate auth URL: ${err.message}`);
    }
  }, [provider, agentId, currentUser]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 p-6">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Handshake Error</h2>
          <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm mx-auto">
            {error}
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/taskforce'}
          className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20"
        >
          Back to Taskforce
        </button>
      </div>
    );
  }

  if (!agentId) {
    return <Navigate to="/taskforce" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <Loader2 className="animate-spin text-emerald-600" size={48} />
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900">Redirecting to {provider}...</h2>
        <p className="text-slate-500">Securely initiating authorization handshake.</p>
      </div>
    </div>
  );
}
