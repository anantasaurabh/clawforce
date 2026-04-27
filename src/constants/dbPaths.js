export const APP_ID = 'clwhq-001'; // Default App ID for this instance

export const COLLECTIONS = {
  USERS: `artifacts/${APP_ID}/public/data/users`,
  AGENTS: `artifacts/${APP_ID}/public/data/agents`,
  PACKAGES: `artifacts/${APP_ID}/public/data/packages`,
  CATEGORIES: `artifacts/${APP_ID}/public/data/categories`,
  TASKS: `artifacts/${APP_ID}/public/data/tasks`,
  GLOBAL_VARS: `artifacts/${APP_ID}/public/data/globalVars`,
  AUTH_GROUPS: `artifacts/${APP_ID}/public/data/authGroups`,
  AUTH_APPS: `artifacts/${APP_ID}/public/data/authApps`,
};

export const getUserConfigPath = (userId) => `artifacts/${APP_ID}/userConfigs/${userId}/agentSettings`;
export const getUserAuthsPath = (userId) => `artifacts/${APP_ID}/userAuthorizations/${userId}/providers`;
