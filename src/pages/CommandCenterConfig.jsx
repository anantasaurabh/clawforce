import React, { useState, useEffect, useRef } from 'react';
import { commandCenterService, catalogService } from '../services/firestore';
import { Plus, X, Rocket, Server, AlertCircle, RefreshCw, Save, Edit, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function CommandCenterConfig() {
  const { isAdmin } = useAuth();
  const [tabs, setTabs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Commander state
  const [isCreatingTab, setIsCreatingTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabSlug, setNewTabSlug] = useState('');
  const [newTabDescription, setNewTabDescription] = useState('');
  const [newTabAvatar, setNewTabAvatar] = useState('');
  const [newTabCustomFields, setNewTabCustomFields] = useState([]);
  const [editingField, setEditingField] = useState({ name: '', label: '', type: 'text', options: '' });
  const [editingTab, setEditingTab] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [tabsData, agentsData] = await Promise.all([
          commandCenterService.getTabs(),
          catalogService.getAgents()
        ]);
        setTabs(tabsData);
        setAgents(agentsData);
      } catch (err) {
        console.error("Failed to load command center config:", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleCreateTab = async () => {
    if (!newTabName.trim() || !newTabSlug.trim()) return;
    setIsCreatingTab(true);
    try {
      if (editingTab) {
        await commandCenterService.updateTab(editingTab.id, {
          name: newTabName,
          slug: newTabSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          description: newTabDescription,
          avatar: newTabAvatar,
          customFields: newTabCustomFields
        });
      } else {
        await commandCenterService.createTab(null, {
          name: newTabName,
          slug: newTabSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
          description: newTabDescription,
          avatar: newTabAvatar,
          customFields: newTabCustomFields,
          order: tabs.length
        });
      }
      const updatedTabs = await commandCenterService.getTabs();
      setTabs(updatedTabs);
      setNewTabName('');
      setNewTabSlug('');
      setNewTabDescription('');
      setNewTabAvatar('');
      setNewTabCustomFields([]);
      setEditingField({ name: '', label: '', type: 'text', options: '' });
      setEditingTab(null);
    } catch (err) {
      console.error("Failed to save commander", err);
    } finally {
      setIsCreatingTab(false);
    }
  };

  const handleEditTab = (tab) => {
    setEditingTab(tab);
    setNewTabName(tab.name || '');
    setNewTabSlug(tab.slug || '');
    setNewTabDescription(tab.description || '');
    setNewTabAvatar(tab.avatar || '');
    setNewTabCustomFields(tab.customFields || []);
  };

  const handleCancelEdit = () => {
    setEditingTab(null);
    setNewTabName('');
    setNewTabSlug('');
    setNewTabDescription('');
    setNewTabAvatar('');
    setNewTabCustomFields([]);
  };

  const handleDeleteTab = async (tabId) => {
    if (window.confirm("Are you sure you want to remove this commander?")) {
      try {
        await commandCenterService.deleteTab(tabId);
        setTabs(tabs.filter(t => t.id !== tabId));
      } catch (err) {
        console.error("Failed to delete commander", err);
      }
    }
  };

  // We no longer need to load agents here because Tabs ARE the orchestrators.
  // The system prompt on the tab defines the orchestrator's behavior.

  const handleAddField = () => {
    if (!editingField.label.trim()) return;
    const name = editingField.name || editingField.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Parse options if it's a select field
    let finalOptions = [];
    if (editingField.type === 'select' && editingField.options) {
       finalOptions = editingField.options.split(',').map(o => o.trim()).filter(o => o);
    }
    
    setNewTabCustomFields([...newTabCustomFields, { 
      label: editingField.label, 
      type: editingField.type, 
      name, 
      ...(editingField.type === 'select' ? { options: finalOptions } : {})
    }]);
    setEditingField({ name: '', label: '', type: 'text', options: '' });
  };

  const handleRemoveField = (idx) => {
    setNewTabCustomFields(newTabCustomFields.filter((_, i) => i !== idx));
  };

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">Access Denied</div>;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><RefreshCw className="animate-spin text-brand-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
          <Server className="text-brand-primary" />
          Your Commanders
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage dynamic commanders and their assigned Orchestrator personalities for the Command Center.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-4">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 overflow-hidden flex-shrink-0">
                  {tab.avatar ? (
                    <img src={tab.avatar} alt={tab.name} className="w-full h-full object-cover" />
                  ) : (
                    <Rocket size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{tab.name}</h3>
                  {tab.description && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{tab.description}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Slug: {tab.slug || tab.name.toLowerCase()}
                    {(tab.customFields?.length > 0) && (
                      <span className="ml-2">({tab.customFields.length} custom fields)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 ml-4">
                <button 
                  onClick={() => handleEditTab(tab)}
                  className="p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-colors"
                  title="Edit Commander"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDeleteTab(tab.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Commander"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
              <AlertCircle className="text-slate-300 mb-3" size={32} />
              <h3 className="font-bold text-slate-700">No Commanders Configured</h3>
              <p className="text-sm text-slate-500">Create a commander using the form to populate the Command Center.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                {editingTab ? 'Edit Commander' : 'Create New Commander'}
              </h3>
              {editingTab && (
                <button 
                  onClick={handleCancelEdit}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
              )}
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Commander Name</label>
                <input
                  type="text"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="e.g., General Marketing, Operations Lead"
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Internal Slug (e.g., digital-marketing-orchestrator)</label>
                <input
                  type="text"
                  value={newTabSlug}
                  onChange={(e) => setNewTabSlug(e.target.value)}
                  placeholder="e.g., marketing-lead"
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-mono text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Short Description</label>
                <textarea
                  value={newTabDescription}
                  onChange={(e) => setNewTabDescription(e.target.value)}
                  placeholder="A brief summary of this commander's goals and personality..."
                  rows={3}
                  className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Commander Portrait</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative h-64 w-48 mx-auto rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-primary/40 hover:bg-slate-100/50 transition-all cursor-pointer overflow-hidden group/img bg-slate-50 flex flex-col items-center justify-center gap-2 shrink-0"
                >
                  {newTabAvatar ? (
                    <>
                      <img src={newTabAvatar} className="w-full h-full object-cover" alt="Preview" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="text-white" size={24} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="text-slate-300" size={32} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center px-4 leading-relaxed">Click to upload portrait</span>
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
                            setNewTabAvatar(resizedBase64);
                          };
                          img.src = event.target.result;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* Dynamic Fields Builder */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dynamic Fields (Optional)</label>
                <div className="space-y-2 mb-3">
                  {newTabCustomFields.map((field, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded text-sm">
                      <div>
                        <span className="font-bold text-slate-700">{field.label}</span>
                        <span className="text-xs text-slate-400 ml-2 font-mono">({field.name})</span>
                        <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded ml-2">{field.type}</span>
                      </div>
                      <button onClick={() => handleRemoveField(idx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={e => setEditingField({ ...editingField, label: e.target.value })}
                    placeholder="Field Label"
                    className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  />
                  <select
                    value={editingField.type}
                    onChange={e => setEditingField({ ...editingField, type: e.target.value })}
                    className="w-28 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  {editingField.type === 'select' && (
                    <input
                      type="text"
                      value={editingField.options}
                      onChange={e => setEditingField({ ...editingField, options: e.target.value })}
                      placeholder="Options (comma separated)"
                      className="flex-1 p-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                    />
                  )}
                  <button onClick={handleAddField} disabled={!editingField.label.trim()} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors disabled:opacity-50">Add</button>
                </div>
              </div>

              <button 
                onClick={handleCreateTab}
                disabled={isCreatingTab || !newTabName.trim() || !newTabSlug.trim()}
                className="mt-2 w-full py-2.5 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {isCreatingTab ? <RefreshCw size={16} className="animate-spin" /> : (editingTab ? <Save size={16} /> : <Plus size={16} />)}
                {editingTab ? 'Save Changes' : 'Add Commander'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
