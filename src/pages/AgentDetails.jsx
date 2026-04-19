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
  Loader2,
  Plus,
  Terminal,
  ShieldCheck,
  Zap,
  Info,
  Send,
  X,
  MessageSquare,
  Activity,
  Pause
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/dbPaths';
import { catalogService, configService, taskService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

  // Deployment Modal State
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [credentials, setCredentials] = useState({});
  const [isConfiguring, setIsConfiguring] = useState(false);

  const hasSchema = agent?.configSchema && agent.configSchema.length > 0;
  const isConfigured = !hasSchema || config?.isConfigured;

  // Task Creation State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Task Detail Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('comments'); // comments, logs

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

      if (!agentSnap.exists()) {
        navigate('/taskforce');
        return;
      }

      const agentData = { id: agentSnap.id, ...agentSnap.data() };
      setAgent(agentData);
      setCategories(cats);

      // Get user config (Resilient)
      try {
        const configData = await configService.getAgentSettings(currentUser.uid, id);
        setConfig(configData);
        if (configData?.credentials) {
          setCredentials(configData.credentials);
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

  // Live Mission History Listener
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
      console.warn('Mission history listener error:', err);
    });

    return () => unsubscribe();
  }, [id, currentUser]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      setIsConfiguring(true);
      await configService.updateAgentSettings(currentUser.uid, id, credentials);
      const newConfig = await configService.getAgentSettings(currentUser.uid, id);
      setConfig(newConfig);
      setShowDeployModal(false);
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save configuration.');
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
      alert('Failed to deploy mission.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 size={12} /> Completed</span>;
      case 'in-progress':
        return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse"><Clock size={12} /> In Progress</span>;
      case 'failed':
        return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={12} /> Failed</span>;
      case 'waiting':
        return <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><Info size={12} /> Waiting Input</span>;
      default:
        return <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><Clock size={12} /> Enqueued</span>;
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

  const filteredTasks = tasks.filter(task =>
    task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <img
                  src={agent.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}&backgroundColor=f8fafc`}
                  alt={agent.name}
                  className="w-full h-full object-cover text-white animate-in fade-in duration-500"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6 pt-2">
            <div className="space-y-3">
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
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
          </div>

          <div className="flex flex-col gap-3 min-w-[220px] pt-4">
            <button
              onClick={() => isConfigured ? setShowTaskModal(true) : setShowDeployModal(true)}
              className={cn(
                "w-full py-4 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg",
                isConfigured
                  ? "bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800"
                  : "bg-brand-primary text-white shadow-brand-primary/20 hover:bg-brand-primary/90"
              )}
            >
              <Plus size={18} />
              {isConfigured ? 'Create Task' : 'Configure Agent'}
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                tabsRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-4 bg-white text-slate-600 border border-slate-100 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <Terminal size={18} />
              <span>View Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div ref={tabsRef} className="bg-white rounded-2xl border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="border-b border-slate-50 px-10 pt-8 flex items-end gap-10">
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "pb-6 text-sm font-black uppercase tracking-widest transition-all border-b-2",
              activeTab === 'history' ? "text-slate-900 border-slate-900" : "text-slate-400 border-transparent hover:text-slate-600"
            )}
          >
            Operational History
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

        <div className="p-10">
          {activeTab === 'history' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="relative group w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="Search mission logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all font-medium"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button className="p-3 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-all">
                    <Filter size={18} />
                  </button>
                  <button className="p-3 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-all">
                    <Download size={18} />
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                    <History size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-900 font-black uppercase tracking-widest text-sm">No Missions Logged</p>
                    <p className="text-slate-400 text-xs font-medium">Deploy your first task to see operational telemetry here.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="pb-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Task ID</th>
                        <th className="pb-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Task Name</th>
                        <th className="pb-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Status</th>
                        <th className="pb-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Date Created</th>
                        <th className="pb-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Duration</th>
                        <th className="pb-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTasks.map((task) => (
                        <tr
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                        >
                          <td className="py-6 font-black text-slate-400 text-xs">#{task.id.slice(-6).toUpperCase()}</td>
                          <td className="py-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-sm">{task.title}</span>
                              {task.description && (
                                <span className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{task.description}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-6">{getStatusBadge(task.status)}</td>
                          <td className="py-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-600 text-[11px] truncate">
                                {task.startTime?.toDate ? task.startTime.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending...'}
                              </span>
                              <span className="text-slate-400 text-[10px] font-medium">
                                {task.startTime?.toDate ? task.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Syncing...'}
                              </span>
                            </div>
                          </td>
                          <td className="py-6 font-black text-slate-400 text-xs">{task.endTime ? '14m 20s' : '--'}</td>
                          <td className="py-6 text-right">
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

              <div className="space-y-8">
                {!hasSchema ? (
                  <div className="p-10 bg-slate-50 rounded-2xl text-center space-y-3">
                    <Zap size={40} className="text-amber-500 mx-auto" />
                    <h5 className="font-black text-slate-900 uppercase tracking-widest text-sm">Autonomous Protocol</h5>
                    <p className="text-slate-500 text-xs font-medium">This agent is pre-configured and ready for direct deployment without additional credentials.</p>
                  </div>
                ) : (
                  <>
                    {agent.configSchema.map((field) => (
                      <div key={field.key} className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                          {field.label}
                          <Info size={12} className="text-slate-300" />
                        </label>
                        <div className="relative group">
                          <input
                            type={field.type === 'password' ? 'password' : 'text'}
                            value={credentials[field.key] || ''}
                            disabled
                            className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-xl text-slate-400 font-bold focus:outline-none cursor-not-allowed italic"
                            placeholder={`••••••••••••••••`}
                          />
                        </div>
                      </div>
                    ))}

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
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Configuration</h2>
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
                      value={credentials[field.key] || ''}
                      className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-brand-primary transition-colors font-bold text-slate-900"
                      onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
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
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Deploy Mission</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Initialize new operational cycle for {agent.name}.</p>
              </div>
            </header>

            <form onSubmit={handleCreateTask} className="p-10 pt-4 space-y-10">
              <div className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Mission Objective / Title</label>
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
                    Agent is fully configured. This mission will execute using your established {agent.tier} credentials.
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
                      Deploy Mission
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

              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-8 break-words">
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
                  {selectedTask.description || 'No detailed instructions provided for this mission.'}
                </p>
              </div>

              <button className="w-full mt-8 py-4 bg-white border-2 border-slate-900 text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-3 group">
                <Pause size={16} className="group-hover:scale-110 transition-transform" />
                Pause Execution
              </button>
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
                    {/* Agent Message */}
                    <div className="flex gap-4 max-w-[90%]">
                      <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shrink-0 mt-1">
                        <Zap size={16} />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 ml-1">
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{agent.name}</span>
                          <span className="text-[9px] font-medium text-slate-400">09:12 AM</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl rounded-tl-none shadow-sm border border-slate-100">
                          <p className="text-slate-600 text-sm font-medium leading-relaxed">
                            Diagnostic check complete. Anomalous entropy detected in packet stream 0x4F2A. Initiating deep inspection protocol 77-B. Please authorize increased compute resources if latency exceeds 20ms.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* User Message */}
                    <div className="flex gap-4 max-w-[90%] self-end flex-row-reverse ml-auto">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0 mt-1">
                        <Activity size={16} />
                      </div>
                      <div className="space-y-2 flex-1 flex flex-col items-end">
                        <div className="flex items-center gap-2 mr-1">
                          <span className="text-[9px] font-medium text-slate-400">09:15 AM</span>
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Operator (You)</span>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-xl rounded-tr-none shadow-xl">
                          <p className="text-slate-200 text-sm font-medium leading-relaxed text-right">
                            Resources authorized. Prioritize the 14.2.11 range. Any indication of brute force attempts?
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Agent Response */}
                    <div className="flex gap-4 max-w-[90%]">
                      <div className="w-9 h-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shrink-0 mt-1">
                        <Zap size={16} />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 ml-1">
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{agent.name}</span>
                          <span className="text-[9px] font-medium text-slate-400">10:02 AM</span>
                        </div>
                        <div className="bg-white p-6 rounded-xl rounded-tl-none shadow-sm border border-slate-100">
                          <pre className="text-slate-600 text-xs font-mono leading-relaxed bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                            [LOG_SCAN]: 14.2.11.0/24 - High-frequency SYN-ACK response observed. No direct brute force signatures detected, but behavior matches standard reconnaissance patterns. Advise maintaining current surveillance state.
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900 rounded-xl p-8 font-mono text-[11px] leading-relaxed text-emerald-500/80 h-full overflow-y-auto custom-scrollbar border border-slate-800">
                    <div className="space-y-1">
                      <p><span className="text-slate-500">[{selectedTask.startTime?.toDate ? selectedTask.startTime.toDate().toLocaleTimeString() : '00:00:00'}]</span> INITIALIZING_CORE_PROTOCOL_77B...</p>
                      <p><span className="text-slate-500">[{selectedTask.startTime?.toDate ? selectedTask.startTime.toDate().toLocaleTimeString() : '00:00:00'}]</span> AUTHENTICATING_CREDENTIALS... <span className="text-emerald-400">OK</span></p>
                      <p><span className="text-slate-500">[{selectedTask.startTime?.toDate ? selectedTask.startTime.toDate().toLocaleTimeString() : '00:00:00'}]</span> CONNECTING_TO_PERIMETER_GATEWAY_14.2.11... <span className="text-emerald-400">ESTABLISHED</span></p>
                      <p className="pt-4 text-emerald-400/50 underline">System Telemetry Log:</p>
                      <p>&gt; Memory Usage: 142MB / 1024MB</p>
                      <p>&gt; CPU Load: 12.4%</p>
                      <p>&gt; Connection Latency: 4ms</p>
                      <p className="pt-4"><span className="text-slate-500">[+14m]</span> HEURISTIC_SCAN_STARTED: Depth 4/5</p>
                      <p><span className="text-slate-500">[+16m]</span> DETECTED_ASYMMETRIC_TRAFFIC: Node 0x4F2A</p>
                      <p><span className="text-slate-500">[+16m]</span> <span className="text-amber-400">WARNING:</span> Entropy threshold exceeded in segment B</p>
                      <p><span className="text-slate-500">[+17m]</span> ANALYZING_SIGNATURES... No matches in global database.</p>
                      <p><span className="text-slate-500">[+18m]</span> WAITING_FOR_OPERATOR_DECISION...</p>
                      <p className="animate-pulse text-emerald-400/40">_</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input (Only show on comments tab) */}
              {detailTab === 'comments' && (
                <div className="p-8 pt-0">
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder="Type a message or command..."
                      className="w-full bg-white border border-slate-200 rounded-full py-5 pl-8 pr-20 shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-800/5 focus:border-emerald-800 transition-all font-medium text-sm"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-800 text-white rounded-lg flex items-center justify-center shadow-lg shadow-emerald-800/20 hover:scale-[1.05] transition-all">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
