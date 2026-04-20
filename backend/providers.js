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
    })
  },
  linkedin_social: {
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientIdEnv: 'LINKEDIN_SOCIAL_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_SOCIAL_CLIENT_SECRET',
    fieldMap: (data) => ({
      linkedin_social_token: data.access_token,
      linkedin_social_expires_at: Date.now() + (data.expires_in * 1000)
    })
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
