import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, getUserConfigPath } from '../constants/dbPaths';

/**
 * User Services
 */
export const userService = {
  async createUserProfile(uid, data) {
    const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
    await setDoc(userRef, {
      ...data,
      status: 'active',
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  },

  async getUserProfile(uid) {
    const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() : null;
  },

  async updateLastSeen(uid) {
    const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
    await setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
  },

  async getAllUsers() {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateUserProfile(uid, data) {
    const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  async deleteUserProfile(uid) {
    const userRef = doc(collection(db, COLLECTIONS.USERS), uid);
    await deleteDoc(userRef);
  }
};

/**
 * Agent & Catalog Services
 */
export const catalogService = {
  async getAgents() {
    const agentsRef = collection(db, COLLECTIONS.AGENTS);
    const snap = await getDocs(agentsRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getCategories() {
    const categoriesRef = collection(db, COLLECTIONS.CATEGORIES);
    const snap = await getDocs(categoriesRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getPackages() {
    const packagesRef = collection(db, COLLECTIONS.PACKAGES);
    const snap = await getDocs(packagesRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async updateCategory(id, data) {
    const ref = doc(collection(db, COLLECTIONS.CATEGORIES), id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async updatePackage(id, data) {
    const ref = doc(collection(db, COLLECTIONS.PACKAGES), id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async createCategory(id, data) {
    const ref = doc(collection(db, COLLECTIONS.CATEGORIES), id || Math.random().toString(36).substr(2, 9));
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async createPackage(id, data) {
    const ref = doc(collection(db, COLLECTIONS.PACKAGES), id || Math.random().toString(36).substr(2, 9));
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async createAgent(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AGENTS), id || Math.random().toString(36).substr(2, 9));
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async updateAgent(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AGENTS), id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async deleteAgent(id) {
    const ref = doc(collection(db, COLLECTIONS.AGENTS), id);
    await deleteDoc(ref);
  },

  async deleteCategory(id) {
    const ref = doc(collection(db, COLLECTIONS.CATEGORIES), id);
    await deleteDoc(ref);
  },

  async deletePackage(id) {
    const ref = doc(collection(db, COLLECTIONS.PACKAGES), id);
    await deleteDoc(ref);
  }
};

/**
 * User Configuration Services (Private)
 */
export const configService = {
  async getAgentSettings(userId, agentId) {
    const ref = doc(collection(db, getUserConfigPath(userId)), agentId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  async updateAgentSettings(userId, agentId, credentials) {
    const ref = doc(db, getUserConfigPath(userId), agentId);
    await setDoc(ref, {
      credentials,
      isConfigured: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
};

/**
 * Task Services
 */
export const taskService = {
  async createOperation(userId, agentId, title, description = '', metadata = {}) {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const docRef = await addDoc(tasksRef, {
      title,
      description,
      agentId,
      ownerId: userId,
      status: 'enqueued',
      progress: 0,
      startTime: serverTimestamp(),
      metadata
    });
    return docRef.id;
  },

  async getUserTasks(userId) {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(
      tasksRef, 
      where('ownerId', '==', userId),
      orderBy('startTime', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addComment(taskId, authorRole, content, authorName = '') {
    const commentsRef = collection(db, COLLECTIONS.TASKS, taskId, 'comments');
    await addDoc(commentsRef, {
      role: authorRole, // 'user' or 'agent'
      authorName,
      content,
      timestamp: serverTimestamp()
    });
  },

  async updateTask(taskId, data) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await updateDoc(taskRef, data);
  },

  async deleteTask(taskId) {
    const taskRef = doc(db, COLLECTIONS.TASKS, taskId);
    await deleteDoc(taskRef);
  }
};
