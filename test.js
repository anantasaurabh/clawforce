import { db } from './src/firebase.js';
import { COLLECTIONS } from './src/constants/dbPaths.js';
console.log('db is:', typeof db, db?.type);
console.log('COLLECTIONS.USERS is:', COLLECTIONS.USERS);
