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
  Loader2,
  Terminal,
  RotateCcw,
  Trash2,
  StopCircle,
  Play
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/dbPaths';
import { taskService } from '../services/firestore';
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
  const [sortConfig, setSortConfig] = useState({ key: 'startTime', direction: 'desc' });

  // Detail Modal State
  const [selectedTask, setSelectedTask] = useState(null);
  const [detailTab, setDetailTab] = useState('comments');
  const [realTimeLogs, setRealTimeLogs] = useState([]);
  const [realTimeComments, setRealTimeComments] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Refs for auto-scroll
  const logsEndRef = React.useRef(null);
  const commentsEndRef = React.useRef(null);

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

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || isSendingMessage || !selectedTask) return;

    try {
      setIsSendingMessage(true);
      await taskService.addComment(
        selectedTask.id,
        'user',
        messageInput,
        currentUser?.displayName || currentUser?.email
      );
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Task ID', 'Status', 'Objective', 'Assigned Agent', 'Deployment'];
    const rows = filteredTasks.map(task => [
      task.id,
      task.status,
      task.title,
      agents[task.agentId]?.name || task.agentId,
      task.startTime?.toDate ? task.startTime.toDate().toLocaleString() : 'N/A'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.map(h => `"${h}"`).join(",") + "\n"
      + rows.map(e => e.map(item => `"${item}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "hq_tasks_report.csv");
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

  const handleRetryTask = async () => {
    if (!selectedTask) return;
    try {
      await taskService.updateTask(selectedTask.id, {
        status: 'enqueued',
        startTime: null,
        endTime: null,
        progress: 0
      });
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10 animate-pulse">
            <Activity size={12} strokeWidth={2.5} />
            In Progress
          </span>
        );
      case 'enqueued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10">
            <Clock size={12} strokeWidth={2.5} />
            Enqueued
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">
            <AlertCircle size={12} strokeWidth={2.5} />
            Failed
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
            {status === 'enqueued' && <Clock size={12} strokeWidth={2.5} />}
            {status}
          </span>
        );
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
          <h1 className="text-4xl font-black text-slate-900 ">Operational Taskboard</h1>
          <p className="text-slate-500 font-medium">Global operational overview of all active and historical agent tasks.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('list')}
              className={cn("p-2 px-4 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all", viewMode === 'list' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <ListIcon size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={cn("p-2 px-4 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all", viewMode === 'kanban' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <LayoutGrid size={16} />
              Kanban
            </button>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="p-3.5 bg-slate-900 text-white rounded-xl shadow-xl shadow-slate-900/20 hover:scale-105 transition-all"
            title="Export to CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="flex items-center justify-end gap-3">
        <div className="relative group w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={14} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-[11px] shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 focus:border-slate-400 transition-all font-medium"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-full shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 font-black text-[10px] uppercase tracking-widest text-slate-600 transition-all cursor-pointer hover:border-slate-300 appearance-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.875rem' }}
        >
          <option value="all">All Statuses</option>
          <option value="enqueued">Enqueued</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button className="p-2.5 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-900 shadow-sm transition-all hover:bg-slate-50">
          <Filter size={16} />
        </button>
      </div>

      {loading ? (
        <div className="py-40 flex flex-col items-center justify-center text-slate-300 gap-4">
          <Loader2 className="animate-spin" size={40} />
          <p className="font-black uppercase tracking-[0.2em] text-xs">Synchronizing Taskboard...</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="">
          <table className="w-full text-left border-separate border-spacing-y-[8px]">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('id')}
                  className="px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Task ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Progress / Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('title')}
                  className="px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Objective {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Agent</th>
                <th
                  onClick={() => handleSort('startTime')}
                  className="px-8 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-900 transition-colors"
                >
                  Deployment {sortConfig.key === 'startTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, idx) => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={cn(
                    "group transition-all cursor-pointer border border-slate-100/50",
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  )}
                >
                  <td className="py-5 px-8 font-bold text-slate-400 text-[11px] rounded-l-xl border-y border-l border-slate-100/50 group-hover:bg-slate-100/30">#OP-{task.id.slice(-4).toUpperCase()}</td>
                  <td className="py-5 px-8 border-y border-slate-100/50 group-hover:bg-slate-100/30">
                    <div className="flex flex-col gap-2">
                      {getStatusBadge(task.status)}
                      <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${task.progress || 0}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-8 border-y border-slate-100/50 group-hover:bg-slate-100/30">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-900 text-sm tracking-tight">{task.title}</span>
                      {task.description && <span className="text-[10px] text-slate-500 font-medium truncate max-w-sm">{task.description}</span>}
                    </div>
                  </td>
                  <td className="py-5 px-8 border-y border-slate-100/50 group-hover:bg-slate-100/30">
                    <div className="flex items-center gap-3">
                      {agents[task.agentId]?.imageUrl ? (
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 shadow-sm">
                          <img src={agents[task.agentId].imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Zap size={12} />
                        </div>
                      )}
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{agents[task.agentId]?.name || task.agentId}</span>
                    </div>
                  </td>
                  <td className="py-5 px-8 border-y border-slate-100/50 group-hover:bg-slate-100/30">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">{task.startTime?.toDate ? task.startTime.toDate().toLocaleDateString() : 'Syncing...'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{task.startTime?.toDate ? task.startTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </td>
                  <td className="py-5 px-8 text-right rounded-r-xl border-y border-r border-slate-100/50 group-hover:bg-slate-100/30">
                    <button className="p-2 text-slate-300 group-hover:text-slate-600 transition-colors">
                      <ArrowRight size={18} />
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
                      <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
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

              <h2 className="text-3xl font-black text-slate-900 leading-tight mb-8 break-words">
                {selectedTask.title}
              </h2>

              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Assigned Agent</span>
                  <div className="flex items-center gap-2">
                    {agents[selectedTask.agentId]?.imageUrl ? (
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200">
                        <img src={agents[selectedTask.agentId].imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center text-white shrink-0">
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
                    Delete Task
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
                                {comment.role === 'user' ? (comment.authorName || 'Operator') : (agents[selectedTask.agentId]?.name || selectedTask.agentId)}
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
                  <div className="bg-slate-900 rounded-xl p-8 font-mono text-[11px] leading-relaxed text-emerald-500/80 h-full overflow-y-auto custom-scrollbar border border-slate-800">
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

              {/* Chat Input */}
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-800 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-800/20 hover:scale-[1.05] transition-all disabled:opacity-50 disabled:hover:scale-100"
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
    </div>
  );
}
