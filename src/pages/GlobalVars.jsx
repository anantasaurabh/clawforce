import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  Save, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Check,
  RefreshCw
} from 'lucide-react';
import { configService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function GlobalVars() {
  const [vars, setVars] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editedVars, setEditedVars] = useState({});
  const [message, setMessage] = useState(null);

  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchVars();
  }, []);

  async function fetchVars() {
    try {
      setLoading(true);
      const data = await configService.getGlobalVars();
      // Remove Firestore timestamps if any
      const cleaned = { ...data };
      delete cleaned.updatedAt;
      setVars(cleaned);
      setEditedVars(cleaned);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to fetch global variables.' });
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateValue = (key, value) => {
    setEditedVars(prev => ({ ...prev, [key]: value }));
  };

  const handleRemove = (key) => {
    const next = { ...editedVars };
    delete next[key];
    setEditedVars(next);
  };

  const handleAdd = () => {
    if (!newKey) return;
    setEditedVars(prev => ({ ...prev, [newKey.trim()]: newValue.trim() }));
    setNewKey('');
    setNewValue('');
  };

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);
      await configService.updateGlobalVars(editedVars);
      setVars(editedVars);
      setMessage({ type: 'success', text: 'Global variables updated successfully.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p>Only system administrators can manage global protocol variables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
            <Globe className="text-brand-primary" /> Global Protocol Variables
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage system-wide environment variables and endpoint configurations.</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={fetchVars}
            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={cn(loading && "animate-spin")} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || JSON.stringify(vars) === JSON.stringify(editedVars)}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 disabled:shadow-none"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Commit Changes
          </button>
        </div>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300",
          message.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-red-50 text-red-800 border border-red-100"
        )}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Variable Key</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Value</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-8 py-6 animate-pulse bg-slate-50/50" colSpan="3" h-16 />
                  </tr>
                ))
              ) : Object.keys(editedVars).length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-8 py-12 text-center text-slate-400 italic text-sm">
                    No global variables configured. Add one below to begin.
                  </td>
                </tr>
              ) : Object.entries(editedVars).map(([key, value]) => (
                <tr key={key} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100/50">
                      {key}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleUpdateValue(key, e.target.value)}
                      className="w-full bg-transparent border-b border-transparent focus:border-emerald-500 focus:outline-none py-1 font-medium text-slate-600 transition-colors"
                      placeholder="Enter value..."
                    />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => handleRemove(key)}
                      className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* Add New Row */}
              <tr className="bg-slate-50/30">
                <td className="px-8 py-6">
                  <input
                    type="text"
                    placeholder="NEW_VARIABLE_KEY"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </td>
                <td className="px-8 py-6">
                  <input
                    type="text"
                    placeholder="Enter variable value..."
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </td>
                <td className="px-8 py-6 text-right">
                  <button
                    onClick={handleAdd}
                    disabled={!newKey}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <Plus size={14} /> Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex items-start gap-4">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest mb-1">Security Protocol</h4>
          <p className="text-sm text-amber-800/80 font-medium leading-relaxed">
            These variables are transmitted to the OpenClaw Runner and injected into the execution environment. 
            Sensitive keys like <code className="bg-amber-100 px-1.5 py-0.5 rounded font-bold">CLAWFORCE_BACKEND_URL</code> or API endpoints should be managed with caution.
            Changes take effect on the next task picked up by the runner.
          </p>
        </div>
      </div>
    </div>
  );
}
