export default {
  authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
  scopes: 'public_profile,pages_manage_posts,pages_show_list',
  clientIdEnv: 'FACEBOOK_CONTENT_AUTOMATION_APP_ID',
  clientSecretEnv: 'FACEBOOK_CONTENT_AUTOMATION_SECRET',
  fieldMap: (data) => ({
    facebook_access_token: data.access_token,
    facebook_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  }),
  postAuthFetch: async (accessToken, axios) => {
    try {
      // 1. Get user info
      const meRes = await axios.get('https://graph.facebook.com/v19.0/me?fields=id,name,picture', {
        params: { access_token: accessToken }
      });
      const me = meRes.data;
      
      const personalInfo = [{
        name: me.name,
        id: me.id,
        pic: me.picture?.data?.url
      }];

      // 2. Get pages
      const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,id,picture,category', {
        params: { access_token: accessToken }
      });
      
      const pages = (pagesRes.data.data || []).map(p => ({
        name: p.name,
        id: p.id,
        token: p.access_token,
        pic: p.picture?.data?.url,
        category: p.category
      }));

      return {
        facebook_user_id: me.id,
        FACEBOOK_PAGE_LIST: JSON.stringify(pages),
        FACEBOOK_PERSONAL_INFO: JSON.stringify(personalInfo)
      };
    } catch (err) {
      console.error('[Facebook PostAuth] Error:', err.response?.data || err.message);
      return {};
    }
  }
};

