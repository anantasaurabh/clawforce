import linkedin_personal from './linkedin_personal.js';
import linkedin_social from './linkedin_social.js';
import google from './google.js';
import facebook from './facebook.js';
import instagram from './instagram.js';

import * as linkedin_personal_performance from './linkedin_personal_performance.js';
import * as linkedin_social_performance from './linkedin_social_performance.js';
import * as facebook_performance from './facebook_performance.js';
import * as instagram_performance from './instagram_performance.js';

export const PROVIDERS = {
  linkedin_personal,
  linkedin_social,
  google,
  facebook,
  instagram
};

export const PERFORMANCE = {
  linkedin_personal: linkedin_personal_performance,
  linkedin_social: linkedin_social_performance,
  facebook: facebook_performance,
  instagram: instagram_performance
};
