import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  LayoutGrid, 
  List as ListIcon, 
  MoreVertical,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Activity,
  X,
  Send,
  Pause,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/dbPaths';
import { useAuth } from '../contexts/AuthContext';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Taskboard() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [agents, setAgents] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // list, kanban
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Detail Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('comments');

  useEffect(() => {
    if (!currentUser) return;

    // Fetch Agents mapping for task names
    const fetchAgents = async () => {
      const q = query(collection(db, COLLECTIONS.AGENTS));
      const snap = await getDoc(doc(db, COLLECTIONS.AGENTS, 'dummy')).catch(() => null); // Just to verify connection
      onSnapshot(collection(db, COLLECTIONS.AGENTS), (snapshot) => {
        const agentMap = {};
        snapshot.docs.forEach(doc => {
          agentMap[doc.id] = doc.data();
        });
        setAgents(agentMap);
      });
    };

    fetchAgents();

    // Live Tasks Listener
    const tasksRef = collection(db, COLLECTIONS.TASKS);
    const q = query(
      tasksRef, 
      where('ownerId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually
      taskList.sort((a, b) => (b.startTime?.seconds || 0) - (a.startTime?.seconds || 0));
      setTasks(taskList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         task.id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 size={12} /> Completed</span>;
      case 'in-progress':
        return <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse"><Activity size={12} /> In Progress</span>;
      case 'enqueued':
        return <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><Clock size={12} /> Enqueued</span>;
      case 'failed':
        return <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"><AlertCircle size={12} /> Failed</span>;
      default:
        return <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider">{status}</span>;
    }
  };

  const columns = [
    { id: 'enqueued', title: 'Enqueued', color: 'bg-blue-500' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-amber-500' },
    { id: 'completed', title: 'Completed', color: 'bg-emerald-500' },
    { id: 'failed', title: 'Failed', color: 'bg-red-500' }
  ];

  return (
    <div className="p-10 space-y-10 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Mission Taskboard</h1>
          <p className="text-slate-500 font-medium">Global operational overview of all active and historical agent missions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 px-4 rounded-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all", viewMode === 'list' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <ListIcon size={16} />
              List
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn("p-2 px-4 rounded-lg flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all", viewMode === 'kanban' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
          </div>
          <button className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xl shadow-slate-900/20 hover:scale-105 transition-all">
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search missions by title, ID, or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-full py-4 pl-12 pr-4 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 transition-all font-medium"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl py-4 px-6 shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 font-black text-xs uppercase tracking-widest text-slate-600"
        >
          <option value="all">All Statuses</option>
          <option value="enqueued">Enqueued</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button className="p-4 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all">
          <Filter size={20} />
        </button>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center text-slate-300 gap-4">
          <Loader2 className="animate-spin" size={40} />
          <p className="font-black uppercase tracking-[0.2em] text-xs">Synchronizing Taskboard...</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mission ID</th>
                <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Objective</th>
                <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Agent</th>
                <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress / Status</th>
                <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deployment</th>
                <th className="p-8 pb-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTasks.map(task => (
                <tr 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className="group hover:bg-slate-50/50 transition-all cursor-pointer"
                >
                  <td className="p-8 font-black text-slate-400 text-xs">#OP-{task.id.slice(-4).toUpperCase()}</td>
                  <td className="p-8">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-900">{task.title}</span>
                      {task.description && <span className="text-[10px] text-slate-400 font-medium truncate max-w-xs">{task.description}</span>}
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="flex items-center gap-2">
                      {agents[task.agentId]?.imageUrl ? (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
                          <img src={agents[task.agentId].imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
                          <Zap size={14} />
                        </div>
                      )}
                      <span className="text-sm font-bold text-slate-700">{agents[task.agentId]?.name || task.agentId}</span>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="flex flex-col gap-2">
                       {getStatusBadge(task.status)}
                       <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${task.progress || 0}%` }} />
                       </div>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">{task.startTime?.toDate ? task.startTime.toDate().toLocaleDateString() : 'Syncing...'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{task.startTime?.toDate ? task.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </td>
                  <td className="p-8">
                    <button className="p-2 text-slate-200 group-hover:text-slate-400 transition-colors">
                      <ArrowRight size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-4 gap-8">
          {columns.map(column => (
            <div key={column.id} className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", column.color)} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">{column.title}</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {filteredTasks.filter(t => t.status === column.id).length}
                  </span>
                </div>
                <MoreVertical size={14} className="text-slate-300" />
              </div>

              <div className="flex flex-col gap-4">
                {filteredTasks.filter(t => t.status === column.id).map(task => (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">#OP-{task.id.slice(-4).toUpperCase()}</span>
                      <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                        <MoreVertical size={12} />
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{task.title}</h4>
                    <div className="flex items-center gap-2">
                      {agents[task.agentId]?.imageUrl ? (
                        <div className="w-6 h-6 rounded-md overflow-hidden border border-slate-200">
                          <img src={agents[task.agentId].imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-white shrink-0">
                          <Zap size={10} />
                        </div>
                      )}
                      <span className="text-[11px] font-bold text-slate-500 truncate">{agents[task.agentId]?.name || task.agentId}</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                       <span className="text-[10px] text-slate-400 font-medium">{task.startTime?.toDate ? task.startTime.toDate().toLocaleDateString() : 'Pending'}</span>
                       {task.progress > 0 && <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{task.progress}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reused Task Detail Modal from AgentDetails */}
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
                    {agents[selectedTask.agentId]?.imageUrl ? (
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200">
                        <img src={agents[selectedTask.agentId].imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center text-white shrink-0">
                        <Zap size={12} />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-700 truncate">{agents[selectedTask.agentId]?.name || selectedTask.agentId}</span>
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

              <div className="space-y-2 flex-1">
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
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{agents[selectedTask.agentId]?.name || selectedTask.agentId}</span>
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
                          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{agents[selectedTask.agentId]?.name || selectedTask.agentId}</span>
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

              {/* Chat Input */}
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
