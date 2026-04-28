export default {
  authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
  scopes: 'public_profile,instagram_basic,instagram_content_publish,pages_show_list',
  clientIdEnv: 'INSTAGRAM_CONTENT_AUTOMATION_APP_ID',
  clientSecretEnv: 'INSTAGRAM_CONTENT_AUTOMATION_SECRET',
  fieldMap: (data) => ({
    instagram_access_token: data.access_token,
    instagram_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  }),
  postAuthFetch: async (accessToken, axios) => {
    try {
      // 1. Get user info from FB
      const meRes = await axios.get('https://graph.facebook.com/v19.0/me?fields=id,name,picture', {
        params: { access_token: accessToken }
      });
      const me = meRes.data;
      
      const personalInfo = [{
        name: me.name,
        id: me.id,
        pic: me.picture?.data?.url
      }];

      // 2. Get FB Pages to find linked IG Accounts
      const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts?fields=name,id,instagram_business_account{id,username,name,profile_picture_url}', {
        params: { access_token: accessToken }
      });
      
      const igAccounts = [];
      const fbPages = pagesRes.data.data || [];
      
      for (const page of fbPages) {
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account;
          igAccounts.push({
            id: ig.id,
            username: ig.username,
            name: ig.name || ig.username,
            pic: ig.profile_picture_url,
            linkedPageId: page.id,
            linkedPageName: page.name
          });
        }
      }

      return {
        facebook_user_id: me.id,
        INSTAGRAM_PAGE_LIST: JSON.stringify(igAccounts),
        INSTAGRAM_PERSONAL_INFO: JSON.stringify(personalInfo)
      };
    } catch (err) {
      console.error('[Instagram PostAuth] Error:', err.response?.data || err.message);
      return {};
    }
  }
};
