import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Package, 
  Edit, 
  Trash2, 
  X, 
  Loader2,
  Shield,
  Bot,
  Layers,
  Check,
  Zap,
  ChevronRight
} from 'lucide-react';
import { catalogService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [pkgs, agts] = await Promise.all([
        catalogService.getPackages(),
        catalogService.getAgents()
      ]);
      setPackages(pkgs);
      setAgents(agts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPackage(null);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the tier package "${name}"? This action cannot be undone.`)) {
      try {
        setLoading(true);
        await catalogService.deletePackage(id);
        await fetchData();
      } catch (err) {
        console.error(err);
        alert('Error deleting package.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Operative Tiers</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage permission levels, agent access envelopes, and concurrency limits.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 shrink-0"
        >
          <Plus size={20} />
          Create Tier Package
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-100 w-1/4 mb-6 rounded" />
              <div className="h-8 bg-slate-100 w-1/2 mb-4 rounded" />
              <div className="h-20 bg-slate-50 rounded-2xl mb-4" />
            </div>
          ))
        ) : packages.map((pkg) => (
          <div key={pkg.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all group relative border-l-8 border-l-emerald-800">
            <div className="flex items-start justify-between mb-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  Tier ID: {pkg.id}
                </span>
                <h3 className="text-3xl font-black text-slate-900 mt-4 tracking-tight">{pkg.name}</h3>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(pkg)}
                  className="p-3 text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-2xl transition-all"
                  title="Edit Tier"
                >
                  <Edit size={20} />
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(pkg.id, pkg.name)}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                    title="Delete Tier"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Zap size={14} className="text-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Concurrency</span>
                </div>
                <p className="text-2xl font-black text-slate-800">{pkg.maxConcurrentTasks || 0} Tasks</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Shield size={14} className="text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Access Envelope</span>
                </div>
                <p className="text-2xl font-black text-slate-800">{pkg.allowedAgentIds?.length || 0} Agents</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Authorized Agents</p>
              <div className="flex flex-wrap gap-2">
                {pkg.allowedAgentIds?.map(agentId => {
                  const agent = agents.find(a => a.id === agentId);
                  return (
                    <div key={agentId} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl shadow-sm text-sm font-bold text-slate-700">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      {agent?.name || agentId}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <PackageModal 
          pkg={editingPackage}
          agents={agents}
          onClose={() => { setShowModal(false); setEditingPackage(null); }}
          onSuccess={() => {
            setShowModal(false);
            setEditingPackage(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function PackageModal({ pkg, agents, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!pkg;

  const [formData, setFormData] = useState({
    id: pkg?.id || '',
    name: pkg?.name || '',
    maxConcurrentTasks: pkg?.maxConcurrentTasks || 2,
    allowedAgentIds: pkg?.allowedAgentIds || []
  });

  const toggleAgent = (id) => {
    setFormData(prev => ({
      ...prev,
      allowedAgentIds: prev.allowedAgentIds.includes(id)
        ? prev.allowedAgentIds.filter(aid => aid !== id)
        : [...prev.allowedAgentIds, id]
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      const data = {
        name: formData.name,
        maxConcurrentTasks: Number(formData.maxConcurrentTasks),
        allowedAgentIds: formData.allowedAgentIds
      };

      if (isEdit) {
        await catalogService.updatePackage(pkg.id, data);
      } else {
        await catalogService.createPackage(formData.id.toLowerCase().replace(/\s+/g, '-'), data);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error saving tier package.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <header className="p-8 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {isEdit ? 'Modify Operative Tier' : 'Deploy New Tier'}
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Configure permissions and agent assignments.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Package Name</label>
                <input 
                  required
                  placeholder="e.g. Field Operative"
                  value={formData.name}
                  className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-bold text-slate-900"
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              {!isEdit && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Unique Identifier</label>
                  <input 
                    required
                    placeholder="e.g. operative-tier-v1"
                    className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-500 bg-slate-50 px-3 rounded-t-xl"
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Concurrency Limit</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" min="1" max="50"
                    value={formData.maxConcurrentTasks}
                    className="flex-1 accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    onChange={(e) => setFormData({...formData, maxConcurrentTasks: e.target.value})}
                  />
                  <div className="w-16 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center font-black text-emerald-800">
                    {formData.maxConcurrentTasks}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                <Bot size={12} /> Assign Authorized Agents
              </label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all group/btn",
                      formData.allowedAgentIds.includes(agent.id)
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-white border-slate-100 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        formData.allowedAgentIds.includes(agent.id) ? "bg-emerald-600 border-white shadow-sm" : "border-slate-200"
                      )}>
                        {formData.allowedAgentIds.includes(agent.id) && <Check size={12} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className={cn("font-bold text-sm", formData.allowedAgentIds.includes(agent.id) ? "text-emerald-900" : "text-slate-500")}>
                        {agent.name}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        <footer className="p-8 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100 mt-0">
          <button onClick={onClose} className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cancel</button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-10 py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-800/20 disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isEdit ? 'Update Tier' : 'Deploy Package')}
          </button>
        </footer>
      </div>
    </div>
  );
}
