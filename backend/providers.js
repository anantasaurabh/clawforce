/**
 * OAuth Provider Configurations
 * Add new providers here by defining their token exchange endpoints and field mappings.
 */
export const PROVIDERS = {
  linkedin_personal: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv: 'LINKEDIN_PERSONAL_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_PERSONAL_CLIENT_SECRET',
    fieldMap: (data) => ({
      linkedin_personal_token: data.access_token,
      linkedin_personal_expires_at: Date.now() + (data.expires_in * 1000)
    }),
    postAuthFetch: async (accessToken, axios) => {
      const headers = { Authorization: `Bearer ${accessToken}` };
      // For personal (OpenID Connect), /userinfo is the correct endpoint for name/pic
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
  },
  linkedin_social: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv: 'LINKEDIN_SOCIAL_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_SOCIAL_CLIENT_SECRET',
    fieldMap: (data) => ({
      linkedin_social_token: data.access_token,
      linkedin_social_expires_at: Date.now() + (data.expires_in * 1000)
    }),
    postAuthFetch: async (accessToken, axios) => {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      };

      // 1. Fetch Member ID & Personal Profile Info
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
        // 2. Fetch Managed Organizations (Administrators) - Get URNs first
        const orgsAclUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';
        const orgsAclRes = await axios.get(orgsAclUrl, { headers });
        
        const urns = (orgsAclRes.data.elements || []).map(el => el.organizationalTarget);
        
        // 3. Fetch details individually but in parallel
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
          linkedin_personal_urn: JSON.stringify(personalInfo)
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
  },
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    fieldMap: (data) => ({
      google_access_token: data.access_token,
      google_refresh_token: data.refresh_token,
      google_expires_at: Date.now() + (data.expires_in * 1000)
    })
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    clientIdEnv: 'FACEBOOK_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
    fieldMap: (data) => ({
      facebook_access_token: data.access_token,
      facebook_expires_at: Date.now() + (data.expires_in * 1000)
    })
  },
  // Add Twitter, Mailchimp, etc. here following the same pattern
};
