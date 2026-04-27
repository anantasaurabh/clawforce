import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword, getAuth, updateProfile as updateAuthProfile, updatePassword as updateAuthPassword } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { COLLECTIONS } from '../constants/dbPaths';

const AuthContext = createContext();

export function useAuth() {
 return useContext(AuthContext);
}

export function AuthProvider({ children }) {
 const [currentUser, setCurrentUser] = useState(null);
 const [userProfile, setUserProfile] = useState(null);
 const [loading, setLoading] = useState(true);

 async function fetchUserProfile(uid, email) {
  try {
   const firestoreDb = db || getFirestore();
   const userRef = doc(collection(firestoreDb, COLLECTIONS.USERS), uid);
   const snap = await getDoc(userRef);
   
   if (snap.exists()) {
    const data = snap.data();
    let updatedData = { ...data };
    
    // Auto-upgrade existing profiles if they are in the admin list
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().split(',').map(e => e.trim());
    const userEmail = (email || '').toLowerCase();
    
    if (adminEmails.includes(userEmail) && updatedData.role !== 'admin') {
      updatedData.role = 'admin';
      await setDoc(userRef, { role: 'admin' }, { merge: true });
    }
    
    setUserProfile(updatedData);
    return updatedData;
   } else {
    // Create a default profile for new users
    const adminEmails = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().split(',').map(e => e.trim());
    const userEmail = (email || '').toLowerCase();
    
    const defaultProfile = {
     displayName: email.split('@')[0],
     email: email,
     role: adminEmails.includes(userEmail) ? 'admin' : 'operator',
     status: 'active',
     packageId: 'starter-pack',
     createdAt: serverTimestamp(),
     lastSeen: serverTimestamp()
    };
    await setDoc(userRef, defaultProfile);
    setUserProfile(defaultProfile);
    return defaultProfile;
   }
  } catch (err) {
   console.error('Error fetching user profile:', err);
   return null;
  }
 }

 function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
 }

 function mockLogin() {
  const mockUser = {
   uid: 'dev-admin-id',
   email: import.meta.env.VITE_ADMIN_EMAIL,
   displayName: 'Super Admin',
   isMock: true
  };
  const mockProfile = {
   role: 'admin',
   displayName: 'Super Admin',
   status: 'active',
   packageId: 'enterprise-elite'
  };
  setCurrentUser(mockUser);
  setUserProfile(mockProfile);
 }

 function logout() {
  setUserProfile(null);
  return signOut(auth);
 }

 function status() {
  // Not used in original, keeping for structure if needed
 }

 function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
 }

 async function registerUser(email, password) {
  // We use a secondary app instance to avoid being logged out 
  // from the admin session when creating a new user.
  const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
   const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
   return result.user;
  } finally {
   await deleteApp(secondaryApp);
  }
 }

 async function updateProfileData(data) {
  if (!currentUser) return;
  const firestoreDb = db || getFirestore();
  const userRef = doc(collection(firestoreDb, COLLECTIONS.USERS), currentUser.uid);
  await setDoc(userRef, data, { merge: true });
  setUserProfile(prev => ({ ...prev, ...data }));
  
  if (data.displayName || data.photoURL) {
   const authUpdate = {};
   if (data.displayName) authUpdate.displayName = data.displayName;
   if (data.photoURL && !data.photoURL.startsWith('data:')) {
    authUpdate.photoURL = data.photoURL;
   }

   if (Object.keys(authUpdate).length > 0) {
    await updateAuthProfile(currentUser, authUpdate);
   }
  }
 }

 function updatePassword(newPassword) {
  if (!currentUser) return;
  return updateAuthPassword(currentUser, newPassword);
 }

 useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
   if (user) {
    setCurrentUser(user);
    await fetchUserProfile(user.uid, user.email);
   } else {
    setCurrentUser(null);
    setUserProfile(null);
   }
   setLoading(false);
  });

  return unsubscribe;
 }, []);

 const value = {
  currentUser,
  userProfile,
  isAdmin: userProfile?.role === 'admin' || (currentUser?.email && (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().split(',').map(e => e.trim()).includes(currentUser.email.toLowerCase())),
  isOperator: userProfile?.role === 'operator',
  login,
  mockLogin,
  logout,
  resetPassword,
  registerUser,
  updateProfileData,
  updatePassword
 };

 return (
  <AuthContext.Provider value={value}>
   {!loading && children}
  </AuthContext.Provider>
 );
}
