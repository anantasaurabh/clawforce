const APP_ID = 'clwhq-001';

export const COLLECTIONS = {
  USERS: `artifacts/${APP_ID}/public/data/users`,
  AGENTS: `artifacts/${APP_ID}/public/data/agents`,
  PACKAGES: `artifacts/${APP_ID}/public/data/packages`,
  CATEGORIES: `artifacts/${APP_ID}/public/data/categories`,
  TASKS: `artifacts/${APP_ID}/public/data/tasks`,
};

export const getUserConfigPath = (userId) => `artifacts/${APP_ID}/userConfigs/${userId}/agentSettings`;
export const getUserAuthsPath = (userId) => `artifacts/${APP_ID}/userAuthorizations/${userId}`;
