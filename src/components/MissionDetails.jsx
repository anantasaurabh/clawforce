import React, { useState, useEffect, useRef } from 'react';
import { X, Check, FileText, Activity, List, Play, Terminal, Copy, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { missionService, taskService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function MissionDetails({ mission, onClose, onUpdate }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('plan'); // 'analytics', 'plan', 'tasks', 'logs'
  const [isUpdating, setIsUpdating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [copying, setCopying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTasks, setDeleteTasks] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const logsEndRef = useRef(null);

  const handleCopyLogs = () => {
    if (!logs.length) return;

    const logText = logs.map(log => {
      const timestamp = log.timestamp?.seconds 
        ? `[${new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour12: false })}] ` 
        : '';
      return `${timestamp}${log.content}`;
    }).join('\n');

    navigator.clipboard.writeText(logText).then(() => {
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    });
  };

  useEffect(() => {
    if (!mission?.id) return;
    
    const unsubscribe = missionService.subscribeMissionLogs(mission.id, (newLogs) => {
      setLogs(newLogs);
    });

    return () => unsubscribe();
  }, [mission?.id]);

  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleApprove = async () => {
    setIsUpdating(true);
    try {
      const updatedData = { status: 'Approved' };
      await missionService.updateMission(mission.id, updatedData);
      onUpdate({ ...mission, ...updatedData });
    } catch (err) {
      console.error("Failed to approve mission", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    setIsUpdating(true);
    try {
      const updatedData = { status: 'Rejected' };
      await missionService.updateMission(mission.id, updatedData);
      onUpdate({ ...mission, ...updatedData });
    } catch (err) {
      console.error("Failed to reject mission", err);
    } finally {
      setIsUpdating(false);
    }
  };
  const handleRestart = async () => {
    setIsUpdating(true);
    try {
      const updatedData = { 
        status: 'Planning',
        plan_doc: null,
        error: null,
        progress: 0
      };
      await missionService.updateMission(mission.id, updatedData);
      onUpdate({ ...mission, ...updatedData });
    } catch (err) {
      console.error("Failed to restart mission", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteTasks) {
        const associatedTasks = await taskService.getMissionTasks(mission.id);
        for (const task of associatedTasks) {
          await taskService.deleteTask(task.id);
        }
      }
      await missionService.deleteMission(mission.id);
      onClose();
    } catch (err) {
      console.error("Failed to delete mission", err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const isFailed = mission.status?.toLowerCase() === 'failed';
  const isCompleted = mission.status?.toLowerCase() === 'completed' || mission.status?.toLowerCase() === 'success';

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Mission?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete <strong>"{mission.title}"</strong>? This action cannot be undone.
            </p>

            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors mb-6">
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${deleteTasks ? 'bg-rose-600 border-rose-600' : 'bg-white border-slate-200'}`}>
                {deleteTasks && <Check size={14} className="text-white" />}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={deleteTasks}
                onChange={(e) => setDeleteTasks(e.target.checked)}
              />
              <div className="flex flex-col text-left flex-1">
                <span className="text-sm font-bold text-slate-800">Also Delete all associated Tasks</span>
                <span className="text-[10px] text-slate-400">Cleans up the task board</span>
              </div>
            </label>

            <div className="flex gap-3 justify-end">
              <button
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-xl text-slate-900">{mission.title}</h2>
            <span className="px-2 py-1 rounded bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
              {mission.status}
            </span>
            {isFailed && (
              <button 
                onClick={handleRestart}
                disabled={isUpdating}
                className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                Retry
              </button>
            )}
            {isCompleted && (
              <button 
                onClick={handleRestart}
                disabled={isUpdating}
                className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                Restart
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="bg-white px-2 py-1 border border-slate-200 rounded">Budget: ${mission.budget_cap}</span>
            <span className="bg-white px-2 py-1 border border-slate-200 rounded">Auto-Pilot: {mission.autoPilotMode ? 'ON' : 'OFF'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowDeleteModal(true)} 
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete Mission"
          >
            <Trash2 size={20} />
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-6 border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 py-4 px-2 border-b-2 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Activity size={16} /> Analytics
        </button>
        <button 
          onClick={() => setActiveTab('plan')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'plan' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <FileText size={16} /> Strategic Plan
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 py-4 px-2 border-b-2 text-sm font-medium transition-colors ${activeTab === 'tasks' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <List size={16} /> Task Tree
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-sm font-medium transition-colors ${activeTab === 'logs' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Terminal size={16} /> Logs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {activeTab === 'plan' && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-a:text-brand-primary">
              {mission.plan_doc ? (
                <ReactMarkdown>{mission.plan_doc}</ReactMarkdown>
              ) : (
                <p className="text-slate-400 italic">No strategic plan generated yet.</p>
              )}
            </div>

            {mission.status === 'WaitingApproval' && (
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm">Action Required</h4>
                  <p className="text-xs text-slate-500">Please review the strategic plan and approve to begin execution.</p>
                </div>
                <button 
                  onClick={handleReject}
                  disabled={isUpdating}
                  className="px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Reject Plan
                </button>
                <button 
                  onClick={handleApprove}
                  disabled={isUpdating}
                  className="px-6 py-2 bg-brand-primary text-white hover:bg-brand-primary/90 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md"
                >
                  <Play size={16} />
                  Approve & Launch
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Activity size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium">Analytics aggregation will appear here once tasks are active.</p>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <List size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium">Child tasks mapped to Taskforce Agents will be listed here.</p>
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="flex flex-col h-[500px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl max-w-4xl mx-auto w-full">
            <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={12} className="text-emerald-400" /> Execution Stream
              </span>
              <button
                onClick={handleCopyLogs}
                disabled={logs.length === 0}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1 text-[10px] font-bold"
                title="Copy Logs"
              >
                {copying ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copying ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-emerald-400 space-y-1 bg-slate-900">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Waiting for deployment output...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={log.id || index} className="leading-relaxed whitespace-pre-wrap break-all">
                    <span className="text-slate-600 mr-2">[{new Date(log.timestamp?.seconds ? log.timestamp.seconds * 1000 : Date.now()).toLocaleTimeString()}]</span>
                    <span className={log.type === 'stderr' ? 'text-rose-400' : 'text-emerald-300'}>
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
    </div>
  );
}
