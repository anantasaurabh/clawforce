export const APP_ID = 'clwhq-001'; // Default App ID for this instance

export const COLLECTIONS = {
  USERS: `artifacts/${APP_ID}/public/data/users`,
  AGENTS: `artifacts/${APP_ID}/public/data/agents`,
  PACKAGES: `artifacts/${APP_ID}/public/data/packages`,
  CATEGORIES: `artifacts/${APP_ID}/public/data/categories`,
  TASKS: `artifacts/${APP_ID}/public/data/tasks`,
};

export const getUserConfigPath = (userId) => `artifacts/${APP_ID}/userConfigs/${userId}/agentSettings`;
