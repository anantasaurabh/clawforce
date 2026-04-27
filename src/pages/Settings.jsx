import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { catalogService } from '../services/firestore';
import { 
  Shield, 
  Settings2, 
  Key, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Settings() {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('my-connections');
  const [authResult, setAuthResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('auth_status');
    if (status) {
      setAuthResult({
        status,
        message: params.get('message'),
        provider: params.get('provider')
      });
      // Clear params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-4xl font-black text-slate-900">System Settings</h1>
        <p className="text-slate-500 mt-1 font-medium">Manage your account connections and system configurations.</p>
      </div>

      {authResult && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 border animate-in fade-in slide-in-from-top-2 duration-500",
          authResult.status === 'success' 
            ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
            : "bg-red-50 border-red-100 text-red-800"
        )}>
          {authResult.status === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div className="flex-1">
            <p className="font-bold text-sm">
              {authResult.status === 'success' 
                ? `Successfully authorized ${authResult.provider || 'the account'}!` 
                : `Authorization Failed: ${authResult.message || 'Unknown error'}`
              }
            </p>
          </div>
          <button onClick={() => setAuthResult(null)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab('my-connections')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'my-connections'
              ? "bg-slate-50 text-brand-primary shadow-inner"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          My Connections
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('auth-providers')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeTab === 'auth-providers'
                ? "bg-slate-50 text-brand-primary shadow-inner"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            Auth Providers (Admin)
          </button>
        )}
      </div>

      {activeTab === 'my-connections' && <MyConnections currentUser={currentUser} />}
      {activeTab === 'auth-providers' && isAdmin && <AuthProvidersAdmin />}
    </div>
  );
}

// --- My Connections Component (User Facing) ---
function MyConnections({ currentUser }) {
  const [groups, setGroups] = useState([]);
  const [apps, setApps] = useState([]);
  const [userAuths, setUserAuths] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  async function fetchData() {
    try {
      setLoading(true);
      const [fetchedGroups, fetchedApps, fetchedAuths] = await Promise.all([
        catalogService.getAuthGroups(),
        catalogService.getAuthApps(),
        catalogService.getUserAuthorizations(currentUser.uid)
      ]);
      setGroups(fetchedGroups);
      setApps(fetchedApps);
      setUserAuths(fetchedAuths || {});
      if (fetchedGroups.length > 0) {
        setActiveGroupId(fetchedGroups[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAuthorize = async (appId) => {
    try {
      // The backend needs to start the OAuth flow.
      // We will redirect the user to the backend which will construct the Auth URL.
      const stateObj = { userId: currentUser.uid, agentId: 'settings' };
      const stateStr = btoa(JSON.stringify(stateObj));
      window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/${appId}?state=${stateStr}`;
    } catch (err) {
      console.error(err);
      alert('Failed to initiate authorization');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-primary" size={32} /></div>;
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center">
        <p className="text-slate-500 font-medium">No connection groups have been configured yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Group Sidebar */}
      <div className="w-full md:w-64 shrink-0 space-y-2">
        {groups.map(group => (
          <button
            key={group.id}
            onClick={() => setActiveGroupId(group.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-between",
              activeGroupId === group.id 
                ? "bg-white border border-slate-100 shadow-sm text-brand-primary" 
                : "text-slate-500 hover:bg-white/50"
            )}
          >
            <span>{group.name}</span>
          </button>
        ))}
      </div>

      {/* Apps Content */}
      <div className="flex-1 space-y-4">
        {apps.filter(a => a.groupId === activeGroupId).length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center text-slate-500 text-sm">
            No applications available in this group.
          </div>
        ) : (
          apps.filter(a => a.groupId === activeGroupId).map(app => {
            const isConnected = !!userAuths[app.id];
            const authData = userAuths[app.id];
            const credentials = authData?.credentials || {};
            // Standardized key or fallback to legacy per-app keys
            const expiresAt = credentials.token_expires_at || credentials[`${app.id}_expires_at`];
            const isExpired = expiresAt && Date.now() > expiresAt;
            const isNearExpiry = expiresAt && (expiresAt - Date.now() < 3 * 24 * 60 * 60 * 1000);

            const getExpiryInfo = () => {
              if (!expiresAt) return null;
              const diff = expiresAt - Date.now();
              if (diff < 0) return 'Expired';
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              if (days > 0) return `Expires in ${days} days`;
              const hours = Math.floor(diff / (1000 * 60 * 60));
              return `Expires in ${hours} hours`;
            };

            const formatFullExpiry = (ts) => {
              if (!ts) return null;
              return new Date(ts).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            };

            const expiryInfo = getExpiryInfo();

            return (
              <div key={app.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col gap-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900">{app.name}</h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">{app.shortDesc}</p>
                    
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {isConnected ? (
                        <>
                          <span className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                            isExpired ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {isExpired ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                            {isExpired ? 'Expired' : 'Connected'}
                          </span>
                          {expiryInfo && !isExpired && (
                            <span className={cn(
                              "text-[11px] font-bold px-2.5 py-1 rounded-full border",
                              isNearExpiry 
                                ? "bg-red-50 text-red-500 border-red-100" 
                                : "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                              {expiryInfo}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                          Not Connected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => handleAuthorize(app.id)}
                      className={cn(
                        "px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2",
                        isConnected && !isExpired
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-brand-primary text-white hover:bg-brand-primary/90"
                      )}
                    >
                      {isConnected && !isExpired ? 'Re-authorize' : 'Authorize Account'}
                      <ExternalLink size={16} />
                    </button>
                    
                    {isConnected && expiresAt && (
                      <div className={cn(
                        "text-[10px] font-bold flex flex-col items-end",
                        isExpired || isNearExpiry ? "text-red-500" : "text-slate-400"
                      )}>
                        <span className="uppercase tracking-tighter text-[8px] opacity-70">Valid Until</span>
                        <span>{formatFullExpiry(expiresAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isConnected && Object.keys(credentials).length > 0 && (
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Key size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Variables & Tokens</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(credentials).map(([key, value]) => {
                        const isToken = key.toLowerCase().includes('token') || key.toLowerCase().includes('secret');
                        return (
                          <div key={key} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-400 truncate">{key}</span>
                            <span className="text-xs font-mono text-slate-600 truncate">
                              {isToken ? '••••••••••••••••' : String(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400 font-medium italic">
                      * These variables are automatically injected into the agent runner environment.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Auth Providers Component (Admin Facing) ---
function AuthProvidersAdmin() {
  const [groups, setGroups] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingApp, setEditingApp] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [fetchedGroups, fetchedApps] = await Promise.all([
        catalogService.getAuthGroups(),
        catalogService.getAuthApps()
      ]);
      setGroups(fetchedGroups);
      setApps(fetchedApps);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteGroup = async (id) => {
    if (window.confirm('Delete this group? Apps inside it will lose their category.')) {
      await catalogService.deleteAuthGroup(id);
      fetchData();
    }
  };

  const handleDeleteApp = async (id) => {
    if (window.confirm('Delete this application mapping?')) {
      await catalogService.deleteAuthApp(id);
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-primary" size={32} /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900">Provider Groups</h2>
          <p className="text-sm text-slate-500 font-medium">Categories for authentications (e.g., Google, LinkedIn).</p>
        </div>
        <button 
          onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-sm"
        >
          <Plus size={16} /> Add Group
        </button>
      </div>

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900">{group.name}</h3>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: {group.id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingGroup(group); setShowGroupModal(true); }} className="p-2 text-slate-400 hover:text-brand-primary"><Edit size={16}/></button>
                <button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                <div className="w-px h-6 bg-slate-100 mx-2" />
                <button 
                  onClick={() => { setEditingApp({ groupId: group.id }); setShowAppModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-lg hover:bg-brand-primary/20"
                >
                  <Plus size={14} /> Add App
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.filter(a => a.groupId === group.id).map(app => (
                <div key={app.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => { setEditingApp(app); setShowAppModal(true); }} className="p-1.5 bg-white text-slate-400 hover:text-brand-primary rounded-lg shadow-sm"><Edit size={14}/></button>
                    <button onClick={() => handleDeleteApp(app.id)} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm"><Trash2 size={14}/></button>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{app.name}</h4>
                  <p className="text-xs text-slate-500 mb-3">{app.shortDesc}</p>
                </div>
              ))}
              {apps.filter(a => a.groupId === group.id).length === 0 && (
                <div className="col-span-full py-4 text-center text-sm font-medium text-slate-400 italic">
                  No applications mapped to this group.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showGroupModal && (
        <GroupModal 
          group={editingGroup} 
          onClose={() => setShowGroupModal(false)} 
          onSuccess={() => { setShowGroupModal(false); fetchData(); }} 
        />
      )}
      
      {showAppModal && (
        <AppModal 
          app={editingApp} 
          groups={groups}
          onClose={() => setShowAppModal(false)} 
          onSuccess={() => { setShowAppModal(false); fetchData(); }} 
        />
      )}
    </div>
  );
}

// --- Group Modal ---
function GroupModal({ group, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    id: group?.id || '',
    name: group?.name || '',
    order: group?.order || 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (group) {
      await catalogService.updateAuthGroup(group.id, formData);
    } else {
      await catalogService.createAuthGroup(formData.id, formData);
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-black mb-4">{group ? 'Edit Group' : 'New Group'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!group && (
            <div>
              <label className="text-xs font-bold text-slate-400">Group ID</label>
              <input required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')})} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. linkedin" />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-400">Name</label>
            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. LinkedIn" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">Order</label>
            <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value)})} className="w-full mt-1 p-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-brand-primary text-white font-bold rounded-lg">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- App Modal ---
function AppModal({ app, groups, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    id: app?.id || '',
    groupId: app?.groupId || groups[0]?.id || '',
    name: app?.name || '',
    shortDesc: app?.shortDesc || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (app && app.id) {
      await catalogService.updateAuthApp(app.id, formData);
    } else {
      await catalogService.createAuthApp(formData.id, formData);
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="bg-white p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-black mb-4">{app?.name ? 'Edit App' : 'New App'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {!app?.name && (
              <div>
                <label className="text-xs font-bold text-slate-400">App ID (Unique)</label>
                <input required value={formData.id} onChange={e => setFormData({...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. linkedin_personal" />
              </div>
            )}
            <div className={app?.name ? "col-span-2" : ""}>
              <label className="text-xs font-bold text-slate-400">Group</label>
              <select value={formData.groupId} onChange={e => setFormData({...formData, groupId: e.target.value})} className="w-full mt-1 p-2 border rounded-lg font-medium">
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400">App Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. LinkedIn Personal Profile" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Short Description</label>
              <input value={formData.shortDesc} onChange={e => setFormData({...formData, shortDesc: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" placeholder="Used for profile posting" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-slate-500">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-brand-primary text-white font-bold rounded-lg">Save Configuration</button>
          </div>
        </form>
      </div>
    </div>
  );
}

