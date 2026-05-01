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
import { COLLECTIONS, getUserConfigPath, getUserAuthsPath } from '../constants/dbPaths';

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
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
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
  },

  async getAuthGroups() {
    const groupsRef = collection(db, COLLECTIONS.AUTH_GROUPS);
    const snap = await getDocs(groupsRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async createAuthGroup(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_GROUPS), id);
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async updateAuthGroup(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_GROUPS), id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async deleteAuthGroup(id) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_GROUPS), id);
    await deleteDoc(ref);
  },

  async getAuthApps() {
    const appsRef = collection(db, COLLECTIONS.AUTH_APPS);
    const snap = await getDocs(appsRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createAuthApp(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_APPS), id);
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async updateAuthApp(id, data) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_APPS), id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async deleteAuthApp(id) {
    const ref = doc(collection(db, COLLECTIONS.AUTH_APPS), id);
    await deleteDoc(ref);
  },

  async getUserAuthorizations(userId) {
    const authRef = collection(db, getUserAuthsPath(userId));
    const snap = await getDocs(authRef);
    const auths = {};
    snap.docs.forEach(doc => {
      auths[doc.id] = doc.data();
    });
    return auths;
  }
};

/**
 * User Configuration Services
 */
export const configService = {
  async getAgentSettings(userId, agentId) {
    const ref = doc(collection(db, getUserConfigPath(userId)), agentId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  async updateAgentSettings(userId, agentId, data) {
    const ref = doc(db, getUserConfigPath(userId), agentId);
    await setDoc(ref, {
      ...data,
      isConfigured: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  async getSharedParameters(userId) {
    const data = await configService.getUserConfig(userId);
    return data?.sharedParameters || {};
  },

  async getUserConfig(userId) {
    const ref = doc(db, `artifacts/clwhq-001/userConfigs`, userId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  async updateSharedParameters(userId, params) {
    const ref = doc(db, `artifacts/clwhq-001/userConfigs`, userId);
    await setDoc(ref, {
      sharedParameters: params,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  async initializeGlobalReviewToken(userId) {
    const ref = doc(db, `artifacts/clwhq-001/userConfigs`, userId);
    const snap = await getDoc(ref);
    const data = snap.data();
    
    if (data?.globalReviewToken) return data.globalReviewToken;

    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await setDoc(ref, {
      globalReviewToken: newToken,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return newToken;
  },

  async getGlobalVars() {
    const ref = doc(db, COLLECTIONS.GLOBAL_VARS, 'settings');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  },

  subscribeGlobalVars(callback) {
    const ref = doc(db, COLLECTIONS.GLOBAL_VARS, 'settings');
    return onSnapshot(ref, (snapshot) => {
      callback(snapshot.exists() ? snapshot.data() : {});
    });
  },

  async updateGlobalVars(data) {
    const ref = doc(db, COLLECTIONS.GLOBAL_VARS, 'settings');
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  async getCompanyInfo(userId) {
    const data = await configService.getUserConfig(userId);
    return {
      companyInfo: data?.companyInfo || '',
      icp: data?.icp || '',
      companyId: data?.companyId || userId // Use userId as default companyId
    };
  },

  async updateCompanyInfo(userId, data) {
    const ref = doc(db, `artifacts/clwhq-001/userConfigs`, userId);
    await setDoc(ref, {
      ...data,
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

  async createSilentOperation(userId, agentId, title, description = '', metadata = {}) {
    const tasksRef = collection(db, COLLECTIONS.SILENT_TASKS);
    const docRef = await addDoc(tasksRef, {
      title,
      description,
      agentId,
      ownerId: userId,
      status: 'enqueued',
      progress: 0,
      startTime: serverTimestamp(),
      metadata: { ...metadata, isSilent: true }
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

  async getMissionTasks(missionId) {
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(
      tasksRef, 
      where('metadata.parent_mission_id', '==', missionId)
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

/**
 * Command Center & Mission Services
 */
export const commandCenterService = {
  async getTabs() {
    const tabsRef = collection(db, COLLECTIONS.COMMANDERS);
    const snap = await getDocs(tabsRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async createTab(id, data) {
    const ref = doc(collection(db, COLLECTIONS.COMMANDERS), id || Math.random().toString(36).substr(2, 9));
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  },

  async updateTab(id, data) {
    const ref = doc(db, COLLECTIONS.COMMANDERS, id);
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  },

  async deleteTab(id) {
    const ref = doc(db, COLLECTIONS.COMMANDERS, id);
    await deleteDoc(ref);
  }
};

export const missionService = {
  async createMission(userId, data) {
    const missionsRef = collection(db, COLLECTIONS.MISSIONS);
    const docRef = await addDoc(missionsRef, {
      ...data,
      ownerId: userId,
      status: 'Planning',
      progress: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async getMissions(userId) {
    const missionsRef = collection(db, COLLECTIONS.MISSIONS);
    const snap = await getDocs(missionsRef);
    const missions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return missions
      .map(m => ({
        ...m,
        ownerId: m.ownerId || m.metadata?.ownerId,
        tab_slug: m.tab_slug || m.metadata?.tab_slug,
        tab_id: m.tab_id || m.metadata?.tab_id,
        status: m.status || m.metadata?.status || 'Planning',
        title: m.title || m.metadata?.title || 'Untitled Mission',
        plan_doc: m.plan_doc || m.metadata?.plan_doc,
        createdAt: m.createdAt || m.metadata?.createdAt,
        updatedAt: m.updatedAt || m.metadata?.updatedAt,
      }))
      .filter(m => !userId || m.ownerId === userId)
      .sort((a, b) => {
        const dateA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0);
        const dateB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0);
        return dateB - dateA;
      });
  },

  subscribeMissions(callback, userId) {
    const missionsRef = collection(db, COLLECTIONS.MISSIONS);
    return onSnapshot(missionsRef, (snapshot) => {
      const missions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const normalized = missions
        .map(m => ({
          ...m,
          ownerId: m.ownerId || m.metadata?.ownerId,
          tab_slug: m.tab_slug || m.metadata?.tab_slug,
          tab_id: m.tab_id || m.metadata?.tab_id,
          status: m.status || m.metadata?.status || 'Planning',
          title: m.title || m.metadata?.title || 'Untitled Mission',
          plan_doc: m.plan_doc || m.metadata?.plan_doc,
          createdAt: m.createdAt || m.metadata?.createdAt,
          updatedAt: m.updatedAt || m.metadata?.updatedAt,
        }))
        .filter(m => !userId || m.ownerId === userId)
        .sort((a, b) => {
          const dateA = a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : new Date(a.updatedAt || 0);
          const dateB = b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : new Date(b.updatedAt || 0);
          return dateB - dateA;
        });
        
      callback(normalized);
    });
  },

  subscribeMissionLogs(missionId, callback) {
    const logsRef = collection(db, COLLECTIONS.MISSIONS, missionId, 'logs');
    const q = query(logsRef, orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(logs);
    });
  },

  async updateMission(missionId, data) {
    const ref = doc(db, COLLECTIONS.MISSIONS, missionId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  },

  async deleteMission(missionId) {
    const ref = doc(db, COLLECTIONS.MISSIONS, missionId);
    await deleteDoc(ref);
  },

  async addComment(missionId, role, content, authorName = '') {
    const commentsRef = collection(db, COLLECTIONS.MISSIONS, missionId, 'comments');
    await addDoc(commentsRef, {
      role, // 'user' or 'agent'
      authorName,
      content,
      timestamp: serverTimestamp()
    });
  },

  subscribeComments(missionId, callback) {
    const commentsRef = collection(db, COLLECTIONS.MISSIONS, missionId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(comments);
    });
  }
};

