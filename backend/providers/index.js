import linkedin_personal from './linkedin_personal.js';
import linkedin_social from './linkedin_social.js';
import google from './google.js';
import facebook from './facebook.js';

import * as linkedin_personal_performance from './linkedin_personal_performance.js';
import * as linkedin_social_performance from './linkedin_social_performance.js';

export const PROVIDERS = {
  linkedin_personal,
  linkedin_social,
  google,
  facebook
};

export const PERFORMANCE = {
  linkedin_personal: linkedin_personal_performance,
  linkedin_social: linkedin_social_performance
};
