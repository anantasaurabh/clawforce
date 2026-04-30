import React, { useState, useEffect } from 'react';
import { 
 Plus, 
 Grid, 
 Edit, 
 Trash2, 
 X, 
 Loader2,
 Tag,
 Palette,
 Check
} from 'lucide-react';
import { catalogService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
 return twMerge(clsx(inputs));
}

const COLORS = [
 { name: 'Emerald', class: 'bg-emerald-500' },
 { name: 'Teal', class: 'bg-teal-500' },
 { name: 'Blue', class: 'bg-blue-600' },
 { name: 'Indigo', class: 'bg-indigo-600' },
 { name: 'Purple', class: 'bg-purple-600' },
 { name: 'Amber', class: 'bg-amber-500' },
 { name: 'Orange', class: 'bg-orange-500' },
 { name: 'Red', class: 'bg-red-600' },
 { name: 'Slate', class: 'bg-slate-600' },
 { name: 'Cyan', class: 'bg-cyan-500' }
];

export default function Categories() {
 const [categories, setCategories] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editingCategory, setEditingCategory] = useState(null);

 const { isAdmin } = useAuth();

 useEffect(() => {
  fetchCategories();
 }, []);

 async function fetchCategories() {
  try {
   setLoading(true);
   const data = await catalogService.getCategories();
   setCategories(data);
  } catch (err) {
   console.error(err);
  } finally {
   setLoading(false);
  }
 }

 const handleEdit = (cat) => {
  setEditingCategory(cat);
  setShowModal(true);
 };

 const handleCreate = () => {
  setEditingCategory(null);
  setShowModal(true);
 };

 const handleDelete = async (id, label) => {
  if (window.confirm(`Are you sure you want to delete the category "${label}"? This may affect agents assigned to it.`)) {
   try {
    setLoading(true);
    await catalogService.deleteCategory(id);
    await fetchCategories();
   } catch (err) {
    console.error(err);
    alert('Error deleting category.');
   } finally {
    setLoading(false);
   }
  }
 };

 return (
  <div className="space-y-6">
   <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
     <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
      <Grid className="text-brand-primary" /> Agent Categories
     </h1>
     <p className="text-slate-500 mt-1 font-medium">Define functional domains and visual identifiers for the agent registry.</p>
    </div>
    <button 
     onClick={handleCreate}
     className="flex items-center gap-2 px-6 py-3 bg-emerald-800 text-white font-bold rounded-xl hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 shrink-0"
    >
     <Plus size={20} />
     Create Category
    </button>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-10">
    {loading ? (
     Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm animate-pulse">
       <div className="w-12 h-12 rounded-lg bg-slate-100 mb-4" />
       <div className="h-6 bg-slate-100 rounded-lg w-1/2 mb-2" />
       <div className="h-4 bg-slate-50 rounded-lg w-3/4" />
      </div>
     ))
    ) : categories.map((cat) => (
     <div key={cat.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-lg transition-all group relative overflow-hidden">
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center text-white mb-6 shadow-lg", cat.color || 'bg-slate-500')}>
       <Grid size={24} />
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 mb-1">{cat.label}</h3>
      <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">{cat.id}</p>
      
      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
       <button 
        onClick={() => handleEdit(cat)}
        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
        title="Edit Category"
       >
        <Edit size={18} />
       </button>
       {isAdmin && (
        <button 
         onClick={() => handleDelete(cat.id, cat.label)}
         className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
         title="Delete Category"
        >
         <Trash2 size={18} />
        </button>
       )}
      </div>
      
      {/* Visual background element */}
      <div className={cn("absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-[0.03] transition-transform group-hover:scale-110", cat.color || 'bg-slate-500')} />
     </div>
    ))}
   </div>

   {showModal && (
    <CategoryModal 
     category={editingCategory}
     onClose={() => { setShowModal(false); setEditingCategory(null); }}
     onSuccess={() => {
      setShowModal(false);
      setEditingCategory(null);
      fetchCategories();
     }}
    />
   )}
  </div>
 );
}

function CategoryModal({ category, onClose, onSuccess }) {
 const [loading, setLoading] = useState(false);
 const isEdit = !!category;

 const [formData, setFormData] = useState({
  id: category?.id || '',
  label: category?.label || '',
  color: category?.color || 'bg-emerald-500'
 });

 async function handleSubmit(e) {
  e.preventDefault();
  try {
   setLoading(true);
   if (isEdit) {
    await catalogService.updateCategory(category.id, {
     label: formData.label,
     color: formData.color
    });
   } else {
    await catalogService.createCategory(formData.id.toLowerCase().replace(/\s+/g, '-'), {
     label: formData.label,
     color: formData.color
    });
   }
   onSuccess();
  } catch (err) {
   console.error(err);
   alert('Error saving category.');
  } finally {
   setLoading(false);
  }
 }

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
   
   <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
    <header className="p-8 pb-4 flex items-center justify-between">
     <div>
      <h2 className="text-3xl font-black text-slate-900 ">
       {isEdit ? 'Update Category' : 'New Category'}
      </h2>
      <p className="text-slate-500 font-medium text-sm mt-1">Configure identifier and visual theme.</p>
     </div>
     <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
      <X size={24} />
     </button>
    </header>

    <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-8">
     <div className="space-y-6">
      <div className="space-y-2">
       <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
        <Tag size={12} /> Display Label
       </label>
       <input 
        required
        placeholder="e.g. Marketing & Ad Strategy"
        value={formData.label}
        className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-bold text-lg text-slate-900"
        onChange={(e) => setFormData({...formData, label: e.target.value})}
       />
      </div>

      {!isEdit && (
       <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Slug Identifier</label>
        <input 
         required
         placeholder="e.g. marketing-strategy"
         className="w-full border-b border-slate-100 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-600 bg-slate-50/50 px-2 rounded-t-lg"
         onChange={(e) => setFormData({...formData, id: e.target.value})}
        />
       </div>
      )}

      <div className="space-y-4">
       <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
        <Palette size={12} /> Select Theme Color
       </label>
       <div className="grid grid-cols-5 gap-3">
        {COLORS.map((c) => (
         <button
          key={c.class}
          type="button"
          onClick={() => setFormData({...formData, color: c.class})}
          className={cn(
           "h-10 rounded-xl transition-all relative flex items-center justify-center",
           c.class,
           formData.color === c.class ? "ring-4 ring-offset-2 ring-emerald-500 scale-110 shadow-lg" : "hover:scale-105"
          )}
         >
          {formData.color === c.class && <Check size={18} className="text-white" strokeWidth={3} />}
         </button>
        ))}
       </div>
      </div>
     </div>
    </form>

    <footer className="p-8 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100">
     <button onClick={onClose} className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cancel</button>
     <button 
      onClick={handleSubmit}
      disabled={loading}
      className="px-10 py-4 bg-emerald-800 text-white font-bold rounded-xl hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-800/20 disabled:opacity-70"
     >
      {loading ? <Loader2 className="animate-spin" size={20} /> : (isEdit ? 'Save Changes' : 'Create Category')}
     </button>
    </footer>
   </div>
  </div>
 );
}
