import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { catalogService, configService, taskService } from '../services/firestore';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Building2,
  Sparkles,
  Save,
  FileText,
  Download,
  Copy,
  Check,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Shield,
  Key,
  Box,
  Code,
  Mail,
  BarChart,
  ShieldCheck,
  Image as ImageIcon,
  Link2,
  ExternalLink,
  Edit
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Settings() {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('my-company');
  const [authResult, setAuthResult] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash) return;

      const cleanHash = hash.replace('#', '');

      if (cleanHash === 'my-company') {
        setActiveTab('my-company');
      } else if (cleanHash === 'my-connections' || cleanHash.startsWith('connection@')) {
        setActiveTab('my-connections');
        if (cleanHash.includes('@')) {
          setDeepLink(cleanHash.split('@')[1]);
        }
      } else if (cleanHash === 'auth-providers') {
        setActiveTab('auth-providers');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
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
          onClick={() => setActiveTab('my-company')}
          className={cn(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'my-company'
              ? "bg-slate-50 text-brand-primary shadow-inner"
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          My Company
        </button>
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

      {activeTab === 'my-company' && <MyCompany currentUser={currentUser} />}
      {activeTab === 'my-connections' && <MyConnections currentUser={currentUser} deepLink={deepLink} onDeepLinkHandled={() => setDeepLink(null)} />}
      {activeTab === 'auth-providers' && isAdmin && <AuthProvidersAdmin />}
    </div>
  );
}

// --- My Company Component ---

function MyCompany({ currentUser }) {
  const [companyData, setCompanyData] = useState({ companyInfo: '', icp: '', companyId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);
  const [activeLocalTab, setActiveLocalTab] = useState('info');
  const [copySuccess, setCopySuccess] = useState(false);
  // Use a ref so Firestore snapshot callbacks always see the latest value of `building`
  // without needing to re-register listeners on every state change.
  const buildingRef = React.useRef(false);

  useEffect(() => {
    // Initial fetch
    configService.getCompanyInfo(currentUser.uid).then(data => {
      setCompanyData(data);
      setLoading(false);
    });

    // --- Real-time listener for ICP updates ---
    // IMPORTANT: We use buildingRef.current instead of the `building` state variable
    // to avoid the stale closure bug where the snapshot callback would always see
    // `building=false` from the time the effect first ran.
    const unsubConfig = onSnapshot(doc(db, `artifacts/clwhq-001/userConfigs`, currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompanyData(prev => ({
          ...prev,
          companyInfo: data.companyInfo || prev.companyInfo,
          icp: data.icp || prev.icp,
          companyId: data.companyId || prev.companyId || currentUser.uid
        }));
        // Use ref so this callback always sees the latest building state
        if (data.icp && buildingRef.current) {
          buildingRef.current = false;
          setBuilding(false);
        }
      }
    });

    // --- Real-time listener for task status (always active, handles failures & completion) ---
    const tasksRef = collection(db, `artifacts/clwhq-001/public/data/silent_tasks`);
    const q = query(tasksRef, where('ownerId', '==', currentUser.uid), orderBy('startTime', 'desc'), limit(1));
    const unsubTasks = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty && buildingRef.current) {
        const taskData = snapshot.docs[0].data();
        if (taskData.status === 'failed') {
          buildingRef.current = false;
          setBuilding(false);
          console.error('ICP Build Task Failed:', taskData.error);
        } else if (taskData.status === 'completed') {
          // Task completed — ICP should arrive via the config listener above.
          // If it doesn't arrive within 10s, release the building lock anyway.
          setTimeout(() => {
            if (buildingRef.current) {
              buildingRef.current = false;
              setBuilding(false);
            }
          }, 10000);
        }
      }
    });

    return () => {
      unsubConfig();
      unsubTasks();
    };
  }, [currentUser.uid]); // Only re-run on uid change; building is tracked via ref

  const handleSaveAndBuild = async () => {
    if (!companyData.companyInfo.trim()) return;

    setSaving(true);
    try {
      // 0. Ensure Review Token exists
      await configService.initializeGlobalReviewToken(currentUser.uid);

      // 1. Save company info
      await configService.updateCompanyInfo(currentUser.uid, {
        companyInfo: companyData.companyInfo
      });

      // 2. Spawn silent task for icp-builder
      buildingRef.current = true; // Set ref BEFORE setBuilding so listeners see it immediately
      setBuilding(true);
      await taskService.createSilentOperation(
        currentUser.uid,
        'icp-builder',
        'Build Ideal Customer Profile (ICP)',
        `Build a detailed ICP based on the following company information:\n\n${companyData.companyInfo}\n\nOutput the final ICP in markdown format.`,
        { companyInfo: companyData.companyInfo }
      );
    } catch (err) {
      console.error(err);
      buildingRef.current = false;
      setBuilding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveICP = async () => {
    setSaving(true);
    try {
      await configService.updateCompanyInfo(currentUser.uid, {
        icp: companyData.icp.substring(0, 5000)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(companyData.icp);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([companyData.icp], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `ICP-${companyData.companyId || 'company'}.md`;
    document.body.appendChild(element);
    element.click();
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-brand-primary" size={32} /></div>;

  return (
    <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.02)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Tabs */}
      <div className="px-10 py-2 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-900 border border-slate-100 shadow-sm">
            {activeLocalTab === 'info' ? <Building2 size={28} /> : <Sparkles className="text-brand-primary" size={28} />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-none">
              {activeLocalTab === 'info' ? 'Company Identity' : 'Ideal Customer Profile'}
            </h2>
            <p className="text-sm text-slate-400 font-medium mt-1.5">
              {activeLocalTab === 'info' ? 'Define your company mission and target market.' : 'AI-generated strategist output based on your identity.'}
            </p>
          </div>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm self-start lg:self-center">
          <button
            onClick={() => setActiveLocalTab('info')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              activeLocalTab === 'info'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Building2 size={16} />
            My Identity
          </button>
          <button
            onClick={() => setActiveLocalTab('icp')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2",
              activeLocalTab === 'icp'
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Sparkles size={16} />
            ICP Strategy
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeLocalTab === 'info' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="relative group">
              <div className="absolute -top-4 -left-4 w-24 h-24 bg-brand-primary/5 rounded-full blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <textarea
                value={companyData.companyInfo}
                onChange={(e) => setCompanyData({ ...companyData, companyInfo: e.target.value })}
                placeholder="E.g. We are an AI company that provides AI-driven marketing automation for e-commerce brands..."
                className="w-full h-[500px] p-8 rounded-[32px] bg-slate-50 border border-slate-100 focus:bg-white focus:ring-8 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all resize-none text-slate-700 font-bold text-lg leading-relaxed shadow-inner"
              />
              <div className="absolute top-8 right-8 text-slate-300 group-focus-within:text-brand-primary/40 transition-colors pointer-events-none">
                <FileText size={24} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
              <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agentic Soul Ready</span>
              </div>

              <button
                onClick={handleSaveAndBuild}
                disabled={saving || building || !companyData.companyInfo.trim()}
                className={cn(
                  "w-full sm:w-auto px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all shadow-xl",
                  (saving || building)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-brand-primary text-white hover:bg-brand-primary/90 hover:scale-[1.01] active:scale-95 shadow-brand-primary/20"
                )}
              >
                {building ? (
                  <><Loader2 className="animate-spin" size={20} /> Building Your ICP...</>
                ) : (
                  <><Sparkles size={20} /> Save & Build ICP</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500">
            {!companyData.icp && !building ? (
              <div className="h-[500px] flex flex-col items-center justify-center gap-6 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-100">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm">
                  <Sparkles size={40} />
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-lg font-black text-slate-900 mb-2">No ICP Strategy Yet</p>
                  <p className="text-sm font-medium text-slate-400 leading-relaxed">
                    Once you provide your company information, our strategist agent will build a detailed profile here.
                  </p>
                </div>
                <button
                  onClick={() => setActiveLocalTab('info')}
                  className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:border-slate-400 transition-all shadow-sm"
                >
                  Go to Company Info
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all text-xs font-black uppercase tracking-widest border border-slate-100"
                  >
                    {copySuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copySuccess ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all text-xs font-black uppercase tracking-widest border border-slate-100"
                  >
                    <Download size={14} />
                    Download .MD
                  </button>

                  <button
                    onClick={handleSaveICP}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Save Changes
                  </button>
                </div>

                <div className="relative group">
                  <textarea
                    value={companyData.icp}
                    onChange={(e) => setCompanyData({ ...companyData, icp: e.target.value.substring(0, 5000) })}
                    maxLength={5000}
                    placeholder={building ? "ICP Builder is analyzing your company info..." : "Your ICP strategy will appear here..."}
                    disabled={building}
                    className={cn(
                      "w-full h-[500px] p-8 rounded-[32px] border transition-all resize-none text-slate-700 font-bold text-lg leading-relaxed shadow-inner",
                      building
                        ? "bg-slate-50/50 border-slate-100 animate-pulse"
                        : "bg-slate-50 border-slate-100 focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500/20"
                    )}
                  />
                  <div className="absolute bottom-8 right-8 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                    {companyData.icp.length} / 5000 Characters
                  </div>
                </div>

                {companyData.companyId && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                        <Globe size={20} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Public Deployment ID</div>
                        <div className="text-xs font-mono font-bold text-slate-600 break-all">{companyData.companyId}</div>
                      </div>
                    </div>
                    <a 
                      href={`${import.meta.env.VITE_BACKEND_URL}/icp/${companyData.companyId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 bg-white text-slate-900 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-slate-400 transition-all shadow-sm flex items-center gap-2"
                    >
                      View Public Context <ArrowRight size={14} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- My Connections Component (User Facing) ---
function MyConnections({ currentUser, deepLink, onDeepLinkHandled }) {
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
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (deepLink && apps.length > 0) {
      const app = apps.find(a => a.id === deepLink);
      if (app) {
        setActiveGroupId(app.groupId);
        // Delay scroll to allow render of the group content
        setTimeout(() => {
          const el = document.getElementById(`app-${deepLink}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-brand-primary', 'ring-offset-8', 'shadow-2xl');
            setTimeout(() => el.classList.remove('ring-2', 'ring-brand-primary', 'ring-offset-8', 'shadow-2xl'), 3000);
          }
          onDeepLinkHandled();
        }, 300);
      }
    }
  }, [deepLink, apps]);

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
              <div key={app.id} id={`app-${app.id}`} className="bg-white p-6 rounded-3xl border border-slate-100 flex flex-col gap-6 scroll-mt-24 transition-all duration-500">
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
                <button onClick={() => { setEditingGroup(group); setShowGroupModal(true); }} className="p-2 text-slate-400 hover:text-brand-primary"><Edit size={16} /></button>
                <button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
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
                    <button onClick={() => { setEditingApp(app); setShowAppModal(true); }} className="p-1.5 bg-white text-slate-400 hover:text-brand-primary rounded-lg shadow-sm"><Edit size={14} /></button>
                    <button onClick={() => handleDeleteApp(app.id)} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm"><Trash2 size={14} /></button>
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
              <input required value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. linkedin" />
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-400">Name</label>
            <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. LinkedIn" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">Order</label>
            <input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })} className="w-full mt-1 p-2 border rounded-lg" />
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
                <input required value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. linkedin_personal" />
              </div>
            )}
            <div className={app?.name ? "col-span-2" : ""}>
              <label className="text-xs font-bold text-slate-400">Group</label>
              <select value={formData.groupId} onChange={e => setFormData({ ...formData, groupId: e.target.value })} className="w-full mt-1 p-2 border rounded-lg font-medium">
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400">App Name</label>
              <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full mt-1 p-2 border rounded-lg" placeholder="e.g. LinkedIn Personal Profile" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">Short Description</label>
              <input value={formData.shortDesc} onChange={e => setFormData({ ...formData, shortDesc: e.target.value })} className="w-full mt-1 p-2 border rounded-lg" placeholder="Used for profile posting" />
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

