export default {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
  clientIdEnv: 'GOOGLE_CLIENT_ID',
  clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  fieldMap: (data) => ({
    google_access_token: data.access_token,
    google_refresh_token: data.refresh_token,
    google_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  })
};
