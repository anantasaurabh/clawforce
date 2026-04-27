export default {
  authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
  scopes: 'public_profile,email,pages_manage_posts,pages_read_engagement',
  clientIdEnv: 'FACEBOOK_CLIENT_ID',
  clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
  fieldMap: (data) => ({
    facebook_access_token: data.access_token,
    facebook_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  })
};
