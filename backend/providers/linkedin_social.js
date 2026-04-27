export default {
  authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  scopes: 'w_member_social r_basicprofile r_organization_social rw_organization_admin w_organization_social',
  clientIdEnv: 'LINKEDIN_SOCIAL_CLIENT_ID',
  clientSecretEnv: 'LINKEDIN_SOCIAL_CLIENT_SECRET',
  fieldMap: (data) => ({
    linkedin_social_token: data.access_token,
    linkedin_social_expires_at: Date.now() + (data.expires_in * 1000),
    token_expires_at: Date.now() + (data.expires_in * 1000)
  }),
  postAuthFetch: async (accessToken, axios) => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0'
    };

    const meRes = await axios.get('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', { headers });
    const meData = meRes.data;
    const memberId = meData.id;
    
    const firstName = meData.localizedFirstName || '';
    const lastName = meData.localizedLastName || '';
    const personalName = `${firstName} ${lastName}`.trim() || 'Personal Profile';
    const personalUrn = `urn:li:person:${memberId}`;
    let personalPic = null;
    try {
      const picElements = meData.profilePicture?.['displayImage~']?.elements || [];
      for (const el of picElements) {
        if (el.identifiers && el.identifiers[0] && el.identifiers[0].identifier) {
          personalPic = el.identifiers[0].identifier;
          break;
        }
      }
    } catch (e) {}

    const personalInfo = [{ name: personalName, urn: personalUrn, pic: personalPic }];

    try {
      const orgsAclUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';
      const orgsAclRes = await axios.get(orgsAclUrl, { headers });
      const urns = (orgsAclRes.data.elements || []).map(el => el.organizationalTarget);
      
      const organizations = await Promise.all(urns.map(async (urn) => {
        try {
          const isBrand = urn.includes('organizationBrand');
          const type = isBrand ? 'organizationBrands' : 'organizations';
          const id = urn.split(':').pop();
          const url = `https://api.linkedin.com/v2/${type}/${id}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`;
          
          const res = await axios.get(url, { headers });
          const data = res.data;
          const name = data.localizedName || data.vanityName || urn;
          
          let pic = null;
          try {
            const elements = data.logoV2?.['original~']?.elements || [];
            for (const el of elements) {
              if (el.identifiers && el.identifiers[0] && el.identifiers[0].identifier) {
                pic = el.identifiers[0].identifier;
                break;
              }
            }
          } catch (e) {}

          return { name, urn, pic };
        } catch (e) {
          return { name: urn, urn, pic: null };
        }
      }));

      return {
        linkedin_social_urn: memberId,
        LINKEDIN_PAGE_URN: JSON.stringify(organizations),
        LINKEDIN_PERSONAL_INFO: JSON.stringify(personalInfo),
        linkedin_social_personal_urn: JSON.stringify(personalInfo)
      };
    } catch (err) {
      console.error('[LinkedIn PostAuth] Overall fetch failed:', err.response?.data || err.message);
      return {
        linkedin_social_urn: memberId,
        LINKEDIN_PAGE_URN: '[]',
        LINKEDIN_PERSONAL_INFO: JSON.stringify(personalInfo),
        linkedin_personal_urn: JSON.stringify(personalInfo)
      };
    }
  }
};
