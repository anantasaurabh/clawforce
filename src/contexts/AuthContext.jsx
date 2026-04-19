import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
      const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        return data;
      } else {
        // Create a default profile for new users
        const defaultProfile = {
          displayName: email.split('@')[0],
          email: email,
          role: email === import.meta.env.VITE_ADMIN_EMAIL ? 'admin' : 'operator',
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
      // Wait a bit to ensure auth propagation if needed, 
      // but usually the result is enough.
      return result.user;
    } finally {
      // Cleanup the secondary app to prevent memory leaks and "App name already exists" errors
      await deleteApp(secondaryApp);
    }
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
    isAdmin: userProfile?.role === 'admin',
    isOperator: userProfile?.role === 'operator',
    login,
    mockLogin,
    logout,
    resetPassword,
    registerUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
