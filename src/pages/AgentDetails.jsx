import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Play,
  History,
  Search,
  Filter,
  Download,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Activity,
  X,
  Send,
  Pause,
  RotateCcw,
  Trash2,
  StopCircle,
  Plus,
  Zap,
  ShieldCheck,
  Link2,
  Info,
  Loader2,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  User,
  UserCog,
  UserRoundCog,
  RefreshCw,
  Eraser
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS, getUserAuthsPath } from '../constants/dbPaths';
import { catalogService, configService, taskService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OAUTH_PROVIDERS } from '../constants/oauthProviders';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function AgentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [agent, setAgent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [config, setConfig] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const tabsRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'startTime', direction: 'desc' });
  const [authResult, setAuthResult] = useState(null);
  const [userAuthorizations, setUserAuthorizations] = useState({});

  // Deployment Modal State
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [sharedParams, setSharedParams] = useState({});
  const [userConfig, setUserConfig] = useState(null);
  const [isConfiguring, setIsConfiguring] = useState(false);

  const hasSchema = agent?.configSchema && agent.configSchema.length > 0;
  // For global only mode, an agent is considered configured if all its schema fields exist in either authorizations or sharedParams
  const isConfigured = !hasSchema || agent.configSchema.every(field => {
    const pool = { ...sharedParams };
    Object.values(userAuthorizations).forEach(auth => {
      if (auth.credentials) {
        Object.entries(auth.credentials).forEach(([k, v]) => {
          pool[k] = v;
          pool[k.toLowerCase()] = v;
          pool[k.toUpperCase()] = v;
        });
      }
    });
    return !!(pool[field.key] || pool[field.key.toLowerCase()] || pool[field.key.toUpperCase()]);
  });

  // Task Creation State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Task Detail Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('comments'); // comments, logs
  const [realTimeLogs, setRealTimeLogs] = useState([]);
  const [realTimeComments, setRealTimeComments] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showHumanControls, setShowHumanControls] = useState(false);
  const humanControlsRef = useRef(null);

  // Refs for auto-scroll
  const logsEndRef = useRef(null);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (id && currentUser) {
      fetchAgentData();
    }
  }, [id, currentUser]);

  async function fetchAgentData() {
    try {
      setLoading(true);

      const agentRef = doc(collection(db, COLLECTIONS.AGENTS), id);
      const [agentSnap, cats] = await Promise.all([
        getDoc(agentRef),
        catalogService.getCategories()
      ]);

      const searchParams = new URLSearchParams(window.location.search);
      const authStatus = searchParams.get('auth_status');
      if (authStatus) {
        // We'll use a local state to show the modal
        setAuthResult({
          status: authStatus,
          message: searchParams.get('message')
        });
        // Clear params to prevent re-shows on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (!agentSnap.exists()) {
        navigate('/taskforce');
        return;
      }

      const agentData = { id: agentSnap.id, ...agentSnap.data() };
      setAgent(agentData);
      setCategories(cats);

      // Get user config (Resilient)
      try {
        const [configData, userCfg] = await Promise.all([
          configService.getAgentSettings(currentUser.uid, id),
          configService.getUserConfig(currentUser.uid)
        ]);
        setConfig(configData);
        setUserConfig(userCfg);

        // Auto-redirect to config if not configured
        const hasSchema = agentData.configSchema && agentData.configSchema.length > 0;
        if (hasSchema && !configData?.isConfigured) {
          setActiveTab('config');
        }

        // Initialize/Fetch Global Secret Token for Handshakes
        await configService.initializeGlobalReviewToken(currentUser.uid);

        // Re-sync after token initialization if it was missing
        const finalUser = await configService.getUserConfig(currentUser.uid);
        setUserConfig(finalUser);
        if (finalUser?.sharedParameters) {
          setSharedParams(finalUser.sharedParameters);
        }
      } catch (cfgErr) {
        console.warn('Agent configuration could not be loaded:', cfgErr);
      }

      // Initial tasks fetch is now handled by live listener useEffect
    } catch (err) {
      console.error('Critical failure loading agent profile:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id || !currentUser) return;

    function handleClickOutside(event) {
      if (humanControlsRef.current && !humanControlsRef.current.contains(event.target)) {
        setShowHumanControls(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live Task History Listener
  useEffect(() => {
    if (!id || !currentUser) return;

    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(
      tasksRef,
      where('agentId', '==', id),
      where('ownerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually to avoid index requirement for now
      taskList.sort((a, b) => (b.startTime?.seconds || 0) - (a.startTime?.seconds || 0));
      setTasks(taskList);
    }, (err) => {
      console.warn('Task history listener error:', err);
    });

    return () => unsubscribe();
  }, [id, currentUser]);

  // Live Authorizations Listener
  useEffect(() => {
    if (!currentUser) return;

    const authsPath = getUserAuthsPath(currentUser.uid);
    const authsRef = collection(db, authsPath);

    const unsubscribe = onSnapshot(authsRef, (snapshot) => {
      const authsMap = {};
      snapshot.forEach(doc => {
        authsMap[doc.id] = doc.data();
      });
      setUserAuthorizations(authsMap);
    }, (err) => {
      console.warn('Authorizations listener error:', err);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Live Sub-collections Listener (Logs & Comments for Selected Task)
  useEffect(() => {
    if (!selectedTask?.id) return;

    // Listen to Logs
    const logsRef = collection(db, COLLECTIONS.TASKS, selectedTask.id, 'logs');
    const logsQuery = query(logsRef, orderBy('timestamp', 'asc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setRealTimeLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Comments
    const commentsRef = collection(db, COLLECTIONS.TASKS, selectedTask.id, 'comments');
    const commentsQuery = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsubscribeComments = onSnapshot(commentsQuery, (snapshot) => {
      setRealTimeComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeLogs();
      unsubscribeComments();
    };
  }, [selectedTask?.id]);

  // Auto-scroll Effects
  useEffect(() => {
    if (detailTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realTimeLogs, detailTab]);

  useEffect(() => {
    if (detailTab === 'comments' && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realTimeComments, detailTab]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setIsConfiguring(true);
      await configService.updateSharedParameters(currentUser.uid, sharedParams);
      setShowDeployModal(false);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save shared parameters.');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      setIsCreatingTask(true);
      await taskService.createOperation(currentUser.uid, id, taskTitle, taskDescription);
      setTaskTitle('');
      setTaskDescription('');
      setShowTaskModal(false);
      // No need to call fetchAgentData() as onSnapshot will pick it up
    } catch (err) {
      console.error('Error creating task:', err);
      alert('Failed to deploy task.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || isSendingMessage || !selectedTask) return;

    try {
      setIsSendingMessage(true);
      await taskService.addComment(
        selectedTask.id,
        'user',
        messageInput,
        userProfile?.name || currentUser?.email
      );
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleRetryTask = async () => {
    if (!selectedTask) return;
    try {
      await taskService.updateTask(selectedTask.id, {
        status: 'enqueued',
        startTime: null,
        endTime: null,
        progress: 0
      });
      // Optionally clear logs for the retry? 
      // User didn't specify, standard Practice is to keep them or at least provide fresh ones.
      // We will just set status to enqueued so runner picks it up.
    } catch (err) {
      console.error('Error retrying task:', err);
    }
  };

  const handleCancelTask = async () => {
    if (!selectedTask) return;
    try {
      await taskService.updateTask(selectedTask.id, {
        status: 'cancelled',
        endTime: serverTimestamp()
      });
    } catch (err) {
      console.error('Error cancelling task:', err);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    if (!window.confirm('Are you sure you want to delete this task? All logs and communications will be lost.')) return;

    try {
      const idToDelete = selectedTask.id;
      setSelectedTask(null);
      await taskService.deleteTask(idToDelete);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Task ID', 'Status', 'Task Name', 'Start Time', 'Duration'];
    const rows = filteredTasks.map(task => [
      task.id,
      task.status,
      task.title,
      task.startTime?.toDate ? task.startTime.toDate().toLocaleString() : 'N/A',
      task.endTime ? '14m 20s' : '--'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.map(h => `"${h}"`).join(",") + "\n"
      + rows.map(e => e.map(item => `"${item}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tasks_${agent?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
            <CheckCircle2 size={12} strokeWidth={2.5} />
            Completed
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10 animate-pulse">
            <Clock size={12} strokeWidth={2.5} />
            In Progress
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
            <AlertCircle size={12} strokeWidth={2.5} />
            Failed
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10">
            <Info size={12} strokeWidth={2.5} />
            Waiting Input
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-400/10">
            <X size={12} strokeWidth={2.5} />
            Cancelled
          </span>
        );
      case 'enqueued':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-600/10">
            <Clock size={12} strokeWidth={2.5} />
            Enqueued
          </span>
        );
    }
  };

  const handleCopyLogs = () => {
    if (!realTimeLogs.length) return;

    const logText = realTimeLogs.map(log => {
      const timestamp = log.timestamp?.toDate ? `[${log.timestamp.toDate().toLocaleTimeString([], { hour12: false })}] ` : '';
      return `${timestamp}${log.content}`;
    }).join('\n');

    navigator.clipboard.writeText(logText).then(() => {
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    });
  };

  const handleRefreshProtocol = () => {
    fetchAgentData();
  };

  const handleDeleteHistory = async () => {
    if (!window.confirm('Are you sure you want to delete all completed/failed tasks for this agent?')) return;

    try {
      const historyToDelete = tasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status));
      await Promise.all(historyToDelete.map(t => taskService.deleteTask(t.id)));
      // Tasks state will be updated by the listener
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-10 animate-pulse">
        <div className="h-48 bg-white rounded-xl" />
        <div className="h-96 bg-white rounded-xl" />
      </div>
    );
  }

  const filteredTasks = tasks
    .filter(task => {
      const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;

      let valA = a[sortConfig.key] || '';
      let valB = b[sortConfig.key] || '';

      if (sortConfig.key === 'startTime') {
        valA = a.startTime?.seconds || 0;
        valB = b.startTime?.seconds || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto space-y-10">


      {/* Consolidated Profile Card */}
      <div className=" relative group">
        {/* Background Visual */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 opacity-50 -skew-x-12 translate-x-1/2 pointer-events-none" />
        <div className="absolute top-1/2 right-20 -translate-y-1/2 text-[180px] font-black text-slate-50 pointer-events-none select-none">
          {agent.id.substring(0, 2).toUpperCase()}
        </div>

        <div className="relative flex flex-col md:flex-row gap-12 items-center md:items-start text-center md:text-left">
          {/* Avatar Area */}
          <div className="relative shrink-0">
            <div className={cn(
              "transition-all duration-500",
              agent.imageUrl ? "w-48 h-64 rounded-3xl" : "w-48 h-48 rounded-full"
            )}>
              <div className={cn(
                "w-full h-full overflow-hidden border-4 border-white shadow-lg relative bg-slate-50",
                agent.imageUrl ? "rounded-2xl" : "rounded-full"
              )}>
                {agent.imageUrl ? (
                  <img
                    src={agent.imageUrl}
                    alt={agent.name}
                    className="w-full h-full object-cover text-white animate-in fade-in duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                    <Bot size={64} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 pt-2">
            <div className="">
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-none">
                {agent.name.split(' ').map((word, i, arr) => (
                  <span key={i} className={i === arr.length - 1 ? "text-brand-primary" : ""}>
                    {word}{i < arr.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </h1>
              <p className="text-slate-500 font-medium text-lg md:text-xl leading-relaxed max-w-2xl">
                {agent.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest">
                {categories.find(c => c.id === agent.category)?.label || agent.category}
              </span>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2 text-slate-400">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Last Activity: {tasks[0] ? 'Recent' : 'No Data'}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-4">
              <div className="relative" ref={humanControlsRef}>
                <button
                  onClick={() => setShowHumanControls(!showHumanControls)}
                  className={cn(
                    "w-full text-xs uppercase text-black/50 hover:text-black/90 transition-all flex items-center justify-center gap-2 font-bold",
                    showHumanControls ? "text-black/90" : "text-black/50"
                  )}
                >
                  <UserRoundCog size={18} />
                  Human Controls
                  <ChevronDown size={16} className={cn("transition-transform duration-300", showHumanControls ? "rotate-180" : "")} />
                </button>

                {showHumanControls && (
                  <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-8px shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="px-10 py-2 mb-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0">Manual Interventions</p>
                    </div>

                    <button
                      onClick={() => {
                        isConfigured ? setShowTaskModal(true) : setShowDeployModal(true);
                        setShowHumanControls(false);
                      }}
                      className="w-full px-10 py-4 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/10 transition-transform">
                        <Plus size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">
                          {isConfigured ? 'Create Task' : 'Configure Agent'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Create and assign task to this agent</span>
                      </div>
                    </button>

                    {/* <button
                      onClick={() => {
                        handleRefreshProtocol();
                        setShowHumanControls(false);
                      }}
                      className="w-full px-10 py-4 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all group-hover:scale-110">
                        <RefreshCw size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Refresh Protocol</span>
                        <span className="text-[10px] text-slate-500 font-medium">Synchronize agent state</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleDeleteHistory();
                        setShowHumanControls(false);
                      }}
                      className="w-full px-10 py-4 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-all group-hover:scale-110">
                        <Eraser size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Clear History</span>
                        <span className="text-[10px] text-slate-500 font-medium">Prune completed task logs</span>
                      </div>
                    </button> */}

                    {isConfigured && agent.customActions?.length > 0 && (
                      <>
                        <hr className="bg-black/10 my-0 text-black/10" />

                        {/* <div className="px-10 py-2 mb-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">External Protocols</p>
                        </div> */}
                        {agent.customActions.map((action, idx) => {
                          const processedUrl = action.url
                            .replace('{{userId}}', currentUser.uid)
                            .replace('{{secretToken}}', userConfig?.globalReviewToken || '')
                            .replace('{{globalToken}}', userConfig?.globalReviewToken || '');

                          return (
                            <a
                              key={idx}
                              href={processedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setShowHumanControls(false)}
                              className="w-full px-10 py-4 text-left hover:bg-slate-50 transition-all flex items-center gap-4 group"
                            >
                              <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0 group-hover:bg-brand-primary group-hover:text-white transition-all">
                                <ExternalLink size={18} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">{action.label}</span>
                                <span className="text-[10px] text-slate-500 font-medium">Direct external handshake</span>
                              </div>
                            </a>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div ref={tabsRef} className="bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="border-b border-slate-50 px-10 pt-8 flex items-end justify-between gap-10">
          <div className="flex gap-10">
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "pb-6 text-sm font-black uppercase tracking-widest transition-all border-b-2",
                activeTab === 'history' ? "text-slate-900 border-slate-900" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              Tasks
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={cn(
                "pb-6 text-sm font-black uppercase tracking-widest transition-all border-b-2",
                activeTab === 'config' ? "text-slate-900 border-slate-900" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              System Parameters
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="flex flex-col md:flex-row items-center gap-2 pb-6">
              <div className="relative group w-full max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={14} />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-[11px] focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all font-medium shadow-sm"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black uppercase tracking-widest text-slate-500 focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all shadow-sm cursor-pointer appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="in-progress">Running</option>
                  <option value="enqueued">Queued</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={handleDownloadCSV}
                  className="p-2.5 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition-all shadow-sm hover:bg-slate-50"
                  title="Export to CSV"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-10">
          {activeTab === 'history' && (
            <div className="space-y-8">


              {tasks.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                    <History size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-900 font-black uppercase tracking-widest text-sm">No Tasks Logged</p>
                    <p className="text-slate-400 text-xs font-medium">Deploy your first task to see operational telemetry here.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-[8px]">
                    <thead>
                      <tr>
                        <th
                          onClick={() => handleSort('id')}
                          className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                        >
                          Task ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                        >
                          Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          onClick={() => handleSort('title')}
                          className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                        >
                          Task Name {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          onClick={() => handleSort('startTime')}
                          className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                        >
                          Date Created {sortConfig.key === 'startTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                        <th className="px-6 pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="">
                      {filteredTasks.map((task, idx) => (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={cn(
                            "group transition-all cursor-pointer border border-slate-100",
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          )}
                        >
                          <td className="py-5 px-6 font-bold text-slate-400 text-[11px] rounded-l-xl border-y border-l border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">#{task.id.slice(-6).toUpperCase()}</td>
                          <td className="py-5 px-6 border-y border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">{getStatusBadge(task.status)}</td>
                          <td className="py-5 px-6 border-y border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-sm tracking-tight">{task.title}</span>
                              {task.description && (
                                <span className="text-[10px] text-slate-500 font-medium truncate max-w-xs">{task.description}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-5 px-6 border-y border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-600 text-[11px] truncate">
                                {task.startTime?.toDate ? task.startTime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending...'}
                              </span>
                              <span className="text-slate-400 text-[10px] font-medium">
                                {task.startTime?.toDate ? task.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Syncing...'}
                              </span>
                            </div>
                          </td>
                          <td className="py-5 px-6 font-black text-slate-400 text-[11px] border-y border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">{task.endTime ? '14m 20s' : '--'}</td>
                          <td className="py-5 px-6 text-right rounded-r-xl border-y border-r border-slate-100 group-hover:border-slate-200 group-hover:bg-slate-100/30">
                            <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                              <MoreVertical size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="max-w-2xl space-y-10">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-6">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-brand-primary shadow-sm shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-1">Encrypted Configuration</h4>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed">
                    System parameters and API credentials are encrypted with AES-256 and stored in your private operational vault. Only you and authorized agents can access these values.
                  </p>
                </div>
              </div>

              {agent.requiredAuths && agent.requiredAuths.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-emerald-600" />
                    <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Protocol Authorizations</h4>
                  </div>
                  <div className="grid gap-4">
                    {agent.requiredAuths.map((authId) => {
                      const provider = OAUTH_PROVIDERS.find(p => p.id === authId);
                      const authData = userAuthorizations[authId];
                      const isAuthorized = !!authData;

                      return (
                        <div key={authId} className="space-y-2">
                          <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-emerald-100 transition-all">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                isAuthorized ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400 group-hover:bg-emerald-50"
                              )}>
                                {isAuthorized ? <ShieldCheck size={20} /> : <Link2 size={20} />}
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                                  {provider?.label || authId}
                                </p>
                                <p className="text-[10px] font-medium text-slate-500">
                                  {isAuthorized
                                    ? `Authorized: ${authData.updatedAt?.toDate ? authData.updatedAt.toDate().toLocaleDateString() : 'Active'}`
                                    : 'Handshake Required'}
                                </p>
                              </div>
                            </div>

                            {isAuthorized ? (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                  <CheckCircle2 size={12} />
                                  Active
                                </div>
                                <button
                                  onClick={() => navigate(`/auth/${authId}?agentId=${id}`)}
                                  className="p-2 text-slate-400 hover:text-slate-900 border border-slate-100 rounded-lg transition-all"
                                  title="Re-authorize"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => navigate(`/auth/${authId}?agentId=${id}`)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10"
                              >
                                Authorize
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {agent.instructions && (
                <div className="p-8 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors">
                    <Info size={40} />
                  </div>
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-2 text-brand-primary">
                      <Terminal size={18} />
                      <h4 className="font-black uppercase tracking-widest text-xs font-federo">Operational Instructions</h4>
                    </div>
                    <div
                      className="text-slate-600 text-sm leading-relaxed instruction-content"
                      dangerouslySetInnerHTML={{ __html: agent.instructions }}
                    />
                  </div>

                  <style dangerouslySetInnerHTML={{
                    __html: `
                    .instruction-content ul {
                      list-style-type: disc;
                      padding-left: 1.5rem;
                      margin: 0.5rem 0;
                    }
                    .instruction-content a {
                      color: #0ea5e9;
                      text-decoration: underline;
                      font-weight: 600;
                    }
                  `}} />
                </div>
              )}

              <div className="space-y-8">
                {!hasSchema ? (
                  <div className="p-10 bg-slate-50 rounded-2xl text-center space-y-3">
                    <Zap size={40} className="text-amber-500 mx-auto" />
                    <h5 className="font-black text-slate-900 uppercase tracking-widest text-sm">Autonomous Protocol</h5>
                    <p className="text-slate-500 text-xs font-medium">This agent is pre-configured and ready for direct deployment without additional credentials.</p>
                  </div>
                ) : (
                  <>
                    {agent.configSchema.map((field) => {
                      // Aggregate all global/shared parameters
                      const globalPool = { ...sharedParams };
                      Object.values(userAuthorizations).forEach(auth => {
                        if (auth.credentials) {
                          Object.entries(auth.credentials).forEach(([k, v]) => {
                            globalPool[k] = v;
                            globalPool[k.toLowerCase()] = v;
                            globalPool[k.toUpperCase()] = v;
                          });
                        }
                      });

                      const displayValue = globalPool[field.key] ||
                        globalPool[field.key.toLowerCase()] ||
                        globalPool[field.key.toUpperCase()] || '';

                      const isAuthShared = !sharedParams[field.key] && !!displayValue;

                      return (
                        <div key={field.key} className="space-y-3">
                          <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-between group/label">
                            <div className="flex items-center gap-2">
                              {field.label}
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black uppercase">
                                {isAuthShared ? 'OAuth Sync' : 'User Shared'}
                              </span>
                            </div>
                          </label>
                          <div className="relative group">
                            <input
                              type={field.type === 'password' ? 'password' : 'text'}
                              value={displayValue}
                              disabled
                              className={cn(
                                "w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-xl font-bold focus:outline-none cursor-not-allowed transition-all",
                                field.type === 'password' ? "text-slate-400 italic" : "text-slate-900 shadow-sm"
                              )}
                              placeholder={field.type === 'password' ? '••••••••••••••••' : `Enter ${field.label}`}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => setShowDeployModal(true)}
                      className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-900 hover:border-slate-900 transition-all shadow-sm"
                    >
                      <Settings size={16} /> Reconfigure Parameters
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowDeployModal(false)} />
          <div className="bg-white max-w-lg w-full rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <header className="p-10 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 ">System Configuration</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Configure {agent.name} for deployment.</p>
              </div>
            </header>

            <form onSubmit={handleSaveConfig} className="p-10 pt-4 space-y-10">
              <div className="space-y-8">
                {agent.configSchema?.length === 0 ? (
                  <div className="p-8 bg-slate-50 rounded-3xl text-center space-y-2">
                    <Zap size={32} className="text-amber-500 mx-auto" />
                    <p className="text-slate-900 font-black text-sm uppercase tracking-widest">Automatic Deployment</p>
                    <p className="text-slate-400 text-xs font-medium">This agent does not require additional configuration.</p>
                  </div>
                ) : agent.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">{field.label}</label>
                    <input
                      required={field.required !== false}
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.type === 'password' ? 'Paste your secure key here...' : `e.g. ${field.label}`}
                      value={sharedParams[field.key] || ''}
                      className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-brand-primary transition-colors font-bold text-slate-900"
                      onChange={(e) => setSharedParams({ ...sharedParams, [field.key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeployModal(false)}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConfiguring}
                  className="flex-[2] py-4 bg-emerald-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-800/20 hover:bg-emerald-900 transition-all flex items-center justify-center gap-2"
                >
                  {isConfiguring ? <Loader2 className="animate-spin" size={20} /> : 'Save Protocol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowTaskModal(false)} />
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <header className="p-10 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 ">Deploy Task</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Initialize new operational cycle for {agent.name}.</p>
              </div>
            </header>

            <form onSubmit={handleCreateTask} className="p-10 pt-4 space-y-10">
              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Task Objective / Title</label>
                  <input
                    required
                    placeholder="e.g. Weekly Pipeline Scan"
                    value={taskTitle}
                    className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-brand-primary transition-colors font-bold text-slate-900"
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">AI Instruction Prompt (Long Detail)</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe the specific task parameters, goal, and any constraints for the AI operative..."
                    value={taskDescription}
                    className="w-full bg-slate-50 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-slate-700 text-sm resize-none"
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </div>

                <div className="p-6 bg-slate-50 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Protocol Verified</span>
                  </div>
                  <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                    Agent is fully configured. This task will execute using your established {agent.tier} credentials.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTask || !taskTitle.trim()}
                  className="flex-[2] py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingTask ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      <Play size={16} />
                      Deploy Task
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedTask(null)} />

          <div className="bg-white w-[95vw] max-w-7xl h-[90vh] rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex">
            {/* Left Panel: Task Info */}
            <div className="w-[450px] border-r border-slate-100 p-10 overflow-y-auto custom-scrollbar flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">#OP-{selectedTask.id.slice(-4).toUpperCase()}</span>
                {getStatusBadge(selectedTask.status)}
              </div>

              <h2 className="text-3xl font-black text-slate-900 leading-tight mb-8 break-words">
                {selectedTask.title}
              </h2>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Assigned Agent</span>
                  <div className="flex items-center gap-2">
                    {agent.imageUrl ? (
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200">
                        <img src={agent.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center text-white shrink-0">
                        <Zap size={12} />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-700 truncate">{agent.name}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Priority</span>
                  <div>
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[9px] uppercase font-black tracking-wider">Critical</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Started</span>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedTask.startTime?.toDate ? selectedTask.startTime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Elapsed Time</span>
                  <span className="text-xs font-bold text-slate-700">04h 12m 45s</span>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Task Description</span>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">
                  {selectedTask.description || 'No detailed instructions provided for this task.'}
                </p>
              </div>

              <div className="space-y-3 mt-8">
                {selectedTask.status === 'in-progress' || selectedTask.status === 'enqueued' ? (
                  <button
                    onClick={handleCancelTask}
                    className="w-full py-4 bg-white border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-3 group"
                  >
                    <StopCircle size={16} className="group-hover:scale-110 transition-transform" />
                    Cancel Execution
                  </button>
                ) : (
                  <button
                    onClick={handleRetryTask}
                    className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 group shadow-xl shadow-slate-900/20"
                  >
                    <RotateCcw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                    {selectedTask.status === 'completed' ? 'Restart Task' : 'Retry Task'}
                  </button>
                )}

                {selectedTask.status === 'cancelled' ? (
                  <button
                    onClick={handleDeleteTask}
                    className="w-full py-4 bg-white border-2 border-red-100 text-red-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-3 group"
                  >
                    <Trash2 size={16} className="group-hover:shake transition-transform" />
                    Delete
                  </button>
                ) : (
                  (['completed', 'failed'].includes(selectedTask.status)) && (
                    <button
                      onClick={handleCancelTask}
                      className="w-full py-4 bg-white border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-3 group"
                    >
                      <StopCircle size={16} className="group-hover:scale-110 transition-transform" />
                      Cancel Task
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Right Panel: Communications & Logs */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
              <header className="p-8 pb-0 flex items-center justify-between">
                <div className="flex gap-10">
                  <button
                    onClick={() => setDetailTab('comments')}
                    className={cn(
                      "pb-6 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                      detailTab === 'comments' ? "text-slate-900 border-slate-900" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    <MessageSquare size={14} className="inline mr-2" />
                    Comments
                  </button>
                  <button
                    onClick={() => setDetailTab('logs')}
                    className={cn(
                      "pb-6 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                      detailTab === 'logs' ? "text-slate-900 border-slate-900" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                  >
                    <Activity size={14} className="inline mr-2" />
                    System Logs
                  </button>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-3 bg-white rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all mb-6">
                  <X size={20} />
                </button>
              </header>

              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {detailTab === 'comments' ? (
                  <div className="space-y-8">
                    {realTimeComments.length === 0 ? (
                      <div className="py-20 text-center space-y-3">
                        <MessageSquare className="mx-auto text-slate-100" size={48} />
                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">No Protocol Messages</p>
                      </div>
                    ) : (
                      realTimeComments.map((comment) => (
                        <div key={comment.id} className={cn(
                          "flex gap-4 max-w-[90%]",
                          comment.role === 'user' ? "self-end flex-row-reverse ml-auto" : ""
                        )}>
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 mt-1",
                            comment.role === 'user' ? "bg-slate-900" : "bg-emerald-800"
                          )}>
                            {comment.role === 'user' ? <Activity size={16} /> : <Zap size={16} />}
                          </div>
                          <div className={cn(
                            "space-y-2 flex-1",
                            comment.role === 'user' ? "flex flex-col items-end" : ""
                          )}>
                            <div className="flex items-center gap-2 mx-1">
                              <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">
                                {comment.role === 'user' ? (comment.authorName || 'Operator') : (agent.name)}
                              </span>
                              <span className="text-[9px] font-medium text-slate-400">
                                {comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <div className={cn(
                              "p-6 rounded-xl shadow-sm border",
                              comment.role === 'user'
                                ? "bg-slate-900 text-slate-200 border-slate-800 rounded-tr-none"
                                : "bg-white text-slate-600 border-slate-100 rounded-tl-none"
                            )}>
                              <p className="text-sm font-medium leading-relaxed">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={commentsEndRef} />
                  </div>
                ) : (
                  <div className="bg-slate-900 rounded-xl p-8 font-mono text-[11px] leading-relaxed text-emerald-500/80 h-full overflow-y-auto custom-scrollbar border border-slate-800 relative group/logs">
                    {realTimeLogs.length > 0 && (
                      <button
                        onClick={handleCopyLogs}
                        className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all opacity-0 group-hover/logs:opacity-100 flex items-center gap-2 border border-slate-700/50"
                        title="Copy Logs"
                      >
                        {copying ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Copy Logs</span>
                          </>
                        )}
                      </button>
                    )}
                    <div className="space-y-1">
                      {realTimeLogs.length === 0 ? (
                        <div className="py-20 text-center space-y-3 opacity-50">
                          <Terminal className="mx-auto" size={48} />
                          <p className="uppercase tracking-widest">Establishing Secure Telemetry...</p>
                        </div>
                      ) : (
                        realTimeLogs.map((log) => (
                          <div key={log.id} className="flex gap-4">
                            <span className="text-slate-500 shrink-0">
                              [{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString([], { hour12: false }) : 'Syncing...'}]
                            </span>
                            <span className={cn(
                              "break-all",
                              log.type === 'stderr' ? "text-red-400" : "text-emerald-500/80"
                            )}>
                              {log.content}
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input (Only show on comments tab) */}
              {detailTab === 'comments' && (
                <div className="p-8 pt-0">
                  <form onSubmit={handleSendMessage} className="relative group">
                    <input
                      type="text"
                      placeholder="Type a message or command..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={isSendingMessage}
                      className="w-full bg-white border border-slate-200 rounded-full py-5 pl-8 pr-20 shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-800/5 focus:border-emerald-800 transition-all font-medium text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isSendingMessage || !messageInput.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-800 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-800/20 hover:scale-[1.05] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {isSendingMessage ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Auth Result Modal */}
      {authResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAuthResult(null)} />
          <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                authResult.status === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              )}>
                {authResult.status === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {authResult.status === 'success' ? 'Authorization Success' : 'Authorization Failed'}
                </h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  {authResult.status === 'success'
                    ? 'Your LinkedIn credentials have been securely provisioned to this agent.'
                    : authResult.message || 'We could not complete the authorization handshake.'}
                </p>
              </div>

              <button
                onClick={() => setAuthResult(null)}
                className={cn(
                  "w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg",
                  authResult.status === 'success'
                    ? "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20"
                    : "bg-red-600 text-white hover:bg-red-700 shadow-red-600/20"
                )}
              >
                {authResult.status === 'success' ? 'Continue Operations' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
