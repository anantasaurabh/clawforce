import React, { useState, useEffect } from 'react';
import {
  Plus,
  Bot,
  Edit,
  Trash2,
  X,
  Loader2,
  Shield,
  Zap,
  Info,
  Settings2,
  Check,
  Search,
  Box,
  Code,
  Globe,
  Mail,
  BarChart,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
  Link2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { catalogService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}


export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [agts, cats] = await Promise.all([
        catalogService.getAgents(),
        catalogService.getCategories()
      ]);
      setAgents(agts);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesCategory = activeCategory === 'All' || agent.category === activeCategory;
    const matchesSearch =
      agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to decomtask agent "${name}"? This action cannot be undone.`)) {
      try {
        setLoading(true);
        await catalogService.deleteAgent(id);
        await fetchData();
      } catch (err) {
        console.error(err);
        alert('Error decomtasking agent.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 ">Agent Registry</h1>
          <p className="text-slate-500 mt-1 font-medium">Configure AI operatives, endpoint schemas, and operational parameters.</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 shrink-0"
          >
            <Plus size={20} />
            Deploy New Agent
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mt-10">
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm w-full lg:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveCategory('All')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeCategory === 'All'
                ? "bg-slate-50 text-emerald-800 shadow-inner"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            All Agents
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeCategory === cat.id
                  ? "bg-slate-50 text-emerald-800 shadow-inner"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by agent name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm focus:outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mt-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 animate-pulse h-[320px]" />
          ))
        ) : filteredAgents.map((agent) => {
          const cat = categories.find(c => c.id === agent.category);

          return (
            <div key={agent.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
              <div className="flex items-start justify-between mb-6">
                <div className={cn("w-14 h-20 rounded-xl overflow-hidden shadow-lg bg-slate-100 flex items-center justify-center")}>
                  {agent.imageUrl ? (
                    <img src={agent.imageUrl} alt={agent.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-slate-300" size={24} />
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleEdit(agent)}
                        className="p-3 text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-2xl transition-all"
                        title="Edit Configuration"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id, agent.name)}
                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                        title="Decomtask Agent"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                    agent.tier === 'premium' ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100"
                  )}>
                    {agent.tier}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat?.label || agent.category}</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3">{agent.name}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium line-clamp-2">
                  {agent.description}
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational</span>
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                  ID: {agent.id}
                </div>
              </div>

              {/* Decorative background slug */}
              <div className={cn("absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-[0.02] transition-transform group-hover:scale-110", cat?.color || 'bg-slate-500')} />
            </div>
          );
        })}
      </div>

      {showModal && (
        <AgentModal
          agent={editingAgent}
          categories={categories}
          onClose={() => { setShowModal(false); setEditingAgent(null); }}
          onSuccess={() => {
            setShowModal(false);
            setEditingAgent(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function AgentModal({ agent, categories, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!agent;

  const [formData, setFormData] = useState({
    id: agent?.id || '',
    name: agent?.name || '',
    description: agent?.description || '',
    category: agent?.category || categories[0]?.id || '',
    tier: agent?.tier || 'basic',
    imageUrl: agent?.imageUrl || '',
    configSchema: Array.isArray(agent?.configSchema) ? agent.configSchema : [],
    instructions: agent?.instructions || ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(agent?.imageUrl || '');
  const fileInputRef = React.useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const addConfigField = () => {
    setFormData(prev => ({
      ...prev,
      configSchema: [...prev.configSchema, { key: '', label: '', type: 'text', required: true }]
    }));
  };

  const removeConfigField = (index) => {
    setFormData(prev => ({
      ...prev,
      configSchema: prev.configSchema.filter((_, i) => i !== index)
    }));
  };

  const updateConfigField = (index, field, value) => {
    const newSchema = [...formData.configSchema];
    newSchema[index] = { ...newSchema[index], [field]: value };
    setFormData(prev => ({ ...prev, configSchema: newSchema }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);

      const subtaskData = { ...formData, imageUrl: imagePreview };

      if (isEdit) {
        await catalogService.updateAgent(agent.id, subtaskData);
      } else {
        await catalogService.createAgent(formData.id.toLowerCase().replace(/\s+/g, '-'), subtaskData);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Error deploying agent configuration.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="bg-white max-w-5xl w-full rounded-[0.5rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <header className="p-8 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-3xl font-black text-slate-900 ">
              {isEdit ? 'Reconfigure Agent' : 'Deploy New Agent'}
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Configure persona, functional tier, and parameters.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Media & Primary Info */}
            <div className="col-span-full lg:col-span-4 space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative h-80 w-60 mx-auto rounded-[8px] border-2 border-dashed border-slate-200 hover:border-emerald-600 transition-all cursor-pointer overflow-hidden group/img bg-slate-50 flex flex-col items-center justify-center gap-2 shrink-0"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="text-white" size={24} />
                    </div>
                  </>
                ) : (
                  <>
                    <Bot className="text-slate-200" size={64} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-6">Click to upload operative portrait</span>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                          const canvas = document.createElement('canvas');
                          const MAX_WIDTH = 600;
                          const MAX_HEIGHT = 900;
                          let width = img.width;
                          let height = img.height;
                          if (width > height) {
                            if (width > MAX_WIDTH) {
                              height *= MAX_WIDTH / width;
                              width = MAX_WIDTH;
                            }
                          } else {
                            if (height > MAX_HEIGHT) {
                              width *= MAX_HEIGHT / height;
                              height = MAX_HEIGHT;
                            }
                          }
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d');
                          ctx.drawImage(img, 0, 0, width, height);
                          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                          setImagePreview(resizedBase64);
                          setFormData(prev => ({ ...prev, imageUrl: resizedBase64 }));
                        };
                        img.src = event.target.result;
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Tier</label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    {['basic', 'premium'].map(tier => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setFormData({ ...formData, tier })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          formData.tier === tier
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</label>
                  <select
                    value={formData.category}
                    className="w-full bg-slate-100 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 font-bold text-slate-900 text-[11px] appearance-none"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Right Column: Details & Configuration */}
            <div className="col-span-full lg:col-span-8 space-y-3">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  {/* <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Agent Name</label> */}
                  <input
                    required
                    placeholder="Agent Name e.g. Sales Prospector"
                    value={formData.name}
                    className="w-full border-b border-slate-100 py-2 focus:outline-none focus:border-emerald-600 transition-colors font-bold text-slate-900 text-lg"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {!isEdit && (
                  <div className="space-y-1.5">
                    {/* <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Agent ID</label> */}
                    <input
                      required
                      placeholder="unique-slug"
                      className="w-full border-b border-slate-100 py-2 focus:outline-none focus:border-emerald-600 transition-colors font-mono text-xs text-slate-500 bg-slate-50 px-2 rounded-t-lg"
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                {/* <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</label> */}
                <textarea
                  rows={2}
                  placeholder="Briefly state agent capabilities..."
                  value={formData.description}
                  className="w-full border-b border-slate-100 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-600 text-sm resize-none"
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="p-5 bg-slate-50 rounded-[1.5rem] space-y-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 size={14} className="text-emerald-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Configuration Blueprint</span>
                  </div>
                  <button
                    type="button"
                    onClick={addConfigField}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest text-emerald-800 hover:border-emerald-600 transition-all shadow-sm"
                  >
                    <Plus size={10} /> Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.configSchema.length === 0 ? (
                    <p className="text-center py-2 text-[10px] text-slate-400 font-medium italic">No custom parameters.</p>
                  ) : formData.configSchema.map((field, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                      <div className="col-span-3">
                        <input
                          placeholder="Field Key"
                          value={field.key}
                          className="w-full text-[10px] font-bold bg-slate-50 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                          onChange={(e) => updateConfigField(index, 'key', e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          placeholder="Display Label"
                          value={field.label}
                          className="w-full text-[10px] font-bold bg-slate-50 border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                          onChange={(e) => updateConfigField(index, 'label', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={field.type}
                          className="w-full text-[10px] font-bold bg-slate-50 border-none rounded-md px-1 py-1 focus:ring-1 focus:ring-emerald-500"
                          onChange={(e) => updateConfigField(index, 'type', e.target.value)}
                        >
                          <option value="text">Text</option>
                          <option value="password">Key</option>
                          <option value="url">Link</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateConfigField(index, 'required', !field.required)}
                          className={cn(
                            "flex-1 text-[8px] font-black uppercase py-1 rounded-md transition-all border",
                            field.required !== false
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-white text-slate-400 border-slate-100"
                          )}
                        >
                          Req
                        </button>
                        <button
                          type="button"
                          onClick={() => removeConfigField(index)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn(
                "space-y-2 transition-all duration-300",
                isExpanded ? "fixed inset-8 z-[60] bg-white p-8 rounded-2xl shadow-2xl flex flex-col" : "relative"
              )}>
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    Operational Instructions
                    <span className="text-[8px] font-bold text-slate-300">(System Parameters)</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 px-2 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1 text-[10px] font-bold"
                  >
                    {isExpanded ? (
                      <>
                        <Minimize2 size={12} /> Exit Fullscreen
                      </>
                    ) : (
                      <>
                        <Maximize2 size={12} /> Maximize
                      </>
                    )}
                  </button>
                </div>
                <div className={cn(isExpanded ? "flex-1 overflow-hidden" : "")}>
                  <RichTextEditor
                    value={formData.instructions}
                    onChange={(val) => setFormData({ ...formData, instructions: val })}
                    placeholder="Setup steps, verification links, etc..."
                    className={isExpanded ? "h-full" : ""}
                  />
                </div>
              </div>

              {isExpanded && (
                <div 
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] animate-in fade-in duration-200" 
                  onClick={() => setIsExpanded(false)} 
                />
              )}
            </div>
          </div>


        </form>

        <footer className="px-8 py-4 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-3 bg-emerald-800 text-white font-bold rounded-xl hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-800/20 disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isEdit ? 'Apply Configuration' : 'Deploy Agent')}
          </button>
        </footer>
      </div>
    </div>
  );
}
