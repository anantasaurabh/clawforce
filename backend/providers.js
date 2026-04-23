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
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return {
        linkedin_personal_urn: response.data.sub // 'sub' is the URN in the OpenID Connect flow
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

      // 1. Fetch Member ID
      const meRes = await axios.get('https://api.linkedin.com/v2/me', { headers });
      const memberId = meRes.data.id;

      try {
        // 2. Fetch Managed Organizations (Administrators) - Get URNs first
        const orgsAclUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';
        const orgsAclRes = await axios.get(orgsAclUrl, { headers });
        
        const urns = (orgsAclRes.data.elements || []).map(el => el.organizationalTarget);
        
        if (urns.length === 0) {
          return { linkedin_social_urn: memberId, LINKEDIN_PAGE_URN: '[]' };
        }

        // 3. Fetch details individually but in parallel to avoid batch throttle
        // We use a combined projection to get name, vanityName, and logo in one hit
        const organizations = await Promise.all(urns.map(async (urn) => {
          try {
            const isBrand = urn.includes('organizationBrand');
            const type = isBrand ? 'organizationBrands' : 'organizations';
            const id = urn.split(':').pop();
            const url = `https://api.linkedin.com/v2/${type}/${id}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`;
            
            const res = await axios.get(url, { headers });
            const data = res.data;
            
            // Extract Name
            const name = data.localizedName || data.vanityName || urn;
            
            // Extract Logo (Pic) - Navigate the complex playableStreams structure
            let pic = null;
            try {
              const elements = data.logoV2?.['original~']?.elements || [];
              // Find the first available external URL
              for (const el of elements) {
                if (el.identifiers && el.identifiers[0] && el.identifiers[0].identifier) {
                  pic = el.identifiers[0].identifier;
                  break;
                }
              }
            } catch (e) {
              console.warn(`[LinkedIn] Logo extraction failed for ${urn}`);
            }

            return { name, urn, pic };
          } catch (e) {
            console.error(`[LinkedIn] Failed to fetch details for ${urn}:`, e.message);
            return { name: urn, urn, pic: null };
          }
        }));

        return {
          linkedin_social_urn: memberId,
          LINKEDIN_PAGE_URN: JSON.stringify(organizations)
        };
      } catch (err) {
        console.error('[LinkedIn PostAuth] Overall fetch failed:', err.response?.data || err.message);
        return {
          linkedin_social_urn: memberId,
          LINKEDIN_PAGE_URN: '[]'
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
