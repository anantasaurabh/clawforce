export default {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  scopes: 'openid profile email',
  clientIdEnv: 'LINKEDIN_PERSONAL_CLIENT_ID',
  clientSecretEnv: 'LINKEDIN_PERSONAL_CLIENT_SECRET',
  fieldMap: (data) => ({
    linkedin_personal_token: data.access_token,
    linkedin_personal_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  }),
  postAuthFetch: async (accessToken, axios) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const url = 'https://api.linkedin.com/v2/userinfo';
    const res = await axios.get(url, { headers });
    const data = res.data;
    
    const name = data.name || `${data.given_name} ${data.family_name}`.trim() || 'Personal Profile';
    const urn = `urn:li:person:${data.sub}`;
    const pic = data.picture || null;

    const personalInfo = [{ name, urn, pic }];

    return {
      linkedin_personal_urn: JSON.stringify(personalInfo),
      LINKEDIN_PERSONAL_INFO: JSON.stringify(personalInfo)
    };
  }
};
