import React, { useState, useEffect, useMemo } from 'react';
import { 
 Plus, 
 Search, 
 MoreVertical, 
 Mail, 
 User, 
 Shield, 
 X,
 Loader2,
 Lock,
 Phone,
 Globe,
 Building,
 MapPin,
 Check,
 ChevronLeft,
 ChevronRight,
 Edit,
 Trash2,
 AlertTriangle,
 Key
} from 'lucide-react';
import { userService, catalogService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
 return twMerge(clsx(inputs));
}

const ITEMS_PER_PAGE = 5;

export default function Users() {
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
 const [filter, setFilter] = useState('All');
 const [searchQuery, setSearchQuery] = useState('');
 const [packages, setPackages] = useState([]);
 
 // Pagination State
 const [currentPage, setCurrentPage] = useState(1);
 const { resetPassword } = useAuth();

 useEffect(() => {
  fetchData();
 }, []);

 async function fetchData() {
  try {
   setLoading(true);
   const [allUsers, allPackages] = await Promise.all([
    userService.getAllUsers(),
    catalogService.getPackages()
   ]);
   setUsers(allUsers);
   setPackages(allPackages);
  } catch (err) {
   console.error(err);
  } finally {
   setLoading(false);
  }
 }

 const filteredUsers = useMemo(() => {
  return users.filter(user => {
   const matchesFilter = filter === 'All' || user.status?.toLowerCase() === filter.toLowerCase();
   const matchesSearch = 
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase());
   return matchesFilter && matchesSearch;
  });
 }, [users, filter, searchQuery]);

 // Pagination Logic
 const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
 const paginatedUsers = useMemo(() => {
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
 }, [filteredUsers, currentPage]);

 const handleEdit = (user) => {
  setEditingUser(user);
  setShowModal(true);
 };

 const handleCreate = () => {
  setEditingUser(null);
  setShowModal(true);
 };

 const handleResetPassword = async (email, name) => {
  if (window.confirm(`System Protocol: Are you sure you want to trigger a password reset for ${name}? This will send an encrypted recovery link to ${email}.`)) {
   try {
    setLoading(true);
    await resetPassword(email);
    alert(`Reset Protocol Initiated: A recovery transtask has been dispatched to ${email}.`);
   } catch (err) {
    console.error(err);
    alert('Critical Error: Failed to initiate reset protocol.');
   } finally {
    setLoading(false);
   }
  }
 };

 const handleDelete = async (uid, name) => {
  if (window.confirm(`Critical Protocol: Are you sure you want to decomtask personnel "${name}"? This will terminate their clearance and remove their profile from the active registry.`)) {
   try {
    setLoading(true);
    await userService.deleteUserProfile(uid);
    await fetchData();
   } catch (err) {
    console.error(err);
    alert('Critical Error: Failed to decomtask personnel.');
   } finally {
    setLoading(false);
   }
  }
 };

 return (
  <div className="space-y-6">
   {/* Header Area */}
   <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
    <div>
     <h1 className="text-4xl font-black text-slate-900 ">User Management</h1>
     <p className="text-slate-500 mt-1 font-medium">Access control, agent package assignments, and real-time operator monitoring.</p>
    </div>
    <button 
     onClick={handleCreate}
     className="flex items-center gap-2 px-6 py-3 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 shrink-0"
    >
     <Plus size={20} />
     Create New User
    </button>
   </div>

   {/* Filters and Search */}
   <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mt-10">
    <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm w-full lg:w-auto overflow-x-auto">
     {['All', 'Active', 'Inactive', 'Suspended'].map((tab) => (
      <button
       key={tab}
       onClick={() => { setFilter(tab); setCurrentPage(1); }}
       className={cn(
        "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
        filter === tab 
         ? "bg-slate-50 text-emerald-800 shadow-inner" 
         : "text-slate-400 hover:text-slate-600"
       )}
      >
       {tab}
      </button>
     ))}
    </div>

    <div className="relative w-full lg:max-w-sm group">
     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={20} />
     <input 
      type="text" 
      placeholder="Search by name, email or protocol..."
      value={searchQuery}
      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 shadow-sm transition-all"
     />
    </div>
   </div>

    <div className="">
     <table className="w-full text-left border-separate border-spacing-y-[8px]">
      <thead>
       <tr>
        <th className="px-8 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">User Identity</th>
        <th className="px-8 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</th>
        <th className="px-8 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Assigned Package</th>
        <th className="px-8 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Last Seen</th>
        <th className="px-8 pb-2"></th>
       </tr>
      </thead>
      <tbody>
       {loading ? (
        <tr>
         <td colSpan={5} className="px-8 py-20 text-center">
          <Loader2 className="animate-spin mx-auto text-emerald-600 mb-2" size={32} />
          <p className="text-slate-400 font-medium tracking-wide text-sm">Synchronizing Personnel Records...</p>
         </td>
        </tr>
       ) : paginatedUsers.length === 0 ? (
        <tr>
         <td colSpan={5} className="px-8 py-20 text-center">
          <p className="text-slate-400 font-medium text-sm">No personnel identities found matching your criteria.</p>
         </td>
        </tr>
       ) : (
        paginatedUsers.map((user, idx) => (
         <tr 
          key={user.id} 
          className={cn(
           "group transition-all border border-slate-100/50",
           idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
          )}
         >
          <td className="px-8 py-5 rounded-l-xl border-y border-l border-slate-100/50 group-hover:bg-slate-100/30">
           <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100">
             <img 
              src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
              alt={user.displayName}
              className="w-full h-full object-cover" 
             />
            </div>
            <div>
             <p className="font-bold text-slate-900 leading-tight tracking-tight">{user.displayName}</p>
             <p className="text-[11px] text-slate-400 font-medium mt-0.5">{user.email}</p>
            </div>
           </div>
          </td>
          <td className="px-8 py-5 border-y border-slate-100/50 group-hover:bg-slate-100/30">
           <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
            user.status === 'active' 
             ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" 
             : user.status === 'suspended'
             ? "bg-red-50 text-red-700 ring-red-600/10"
             : "bg-slate-50 text-slate-600 ring-slate-600/10"
           )}>
            {user.status || 'Active'}
           </span>
          </td>
          <td className="px-8 py-5 border-y border-slate-100/50 group-hover:bg-slate-100/30">
           <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
             <Building size={14} />
            </div>
            <span className="font-bold text-slate-700 text-xs">
             {packages.find(p => p.id === user.packageId)?.name || 'Standard Analyst'}
            </span>
           </div>
          </td>
          <td className="px-8 py-5 border-y border-slate-100/50 group-hover:bg-slate-100/30 text-xs text-slate-500 font-bold">
           {user.lastSeen ? (
            new Date(user.lastSeen.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
           ) : (
            'Never'
           )}
          </td>
          <td className="px-8 py-5 text-right rounded-r-xl border-y border-r border-slate-100/50 group-hover:bg-slate-100/30">
           <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
             onClick={() => handleResetPassword(user.email, user.displayName)}
             className="p-2 text-slate-400 hover:text-amber-600 transition-colors rounded-full hover:bg-amber-50"
             title="Reset Password"
            >
             <Key size={16} />
            </button>
            <button 
             onClick={() => handleEdit(user)}
             className="p-2 text-slate-400 hover:text-emerald-600 transition-colors rounded-full hover:bg-emerald-50"
             title="Edit User"
            >
             <Edit size={16} />
            </button>
            <button 
             onClick={() => handleDelete(user.id, user.displayName)}
             className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
             title="Decomtask User"
            >
             <Trash2 size={16} />
            </button>
           </div>
          </td>
         </tr>
        ))
       )}
      </tbody>
     </table>
    </div>
    
    {/* Pagination Controls */}
    <div className="p-8 border-t border-slate-50 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
     <p>Showing {paginatedUsers.length} of {filteredUsers.length} Personnel Identities</p>
     <div className="flex items-center gap-2">
      <button 
       onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
       disabled={currentPage === 1}
       className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-100 disabled:opacity-30 enabled:hover:bg-slate-50"
      >
       <ChevronLeft size={16} />
      </button>
      
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
       <button 
        key={p}
        onClick={() => setCurrentPage(p)}
        className={cn(
         "w-8 h-8 rounded-full flex items-center justify-center transition-all",
         currentPage === p ? "bg-slate-50 text-emerald-800 border border-slate-100" : "hover:text-slate-600"
        )}
       >
        {p}
       </button>
      ))}

      <button 
       onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
       disabled={currentPage === totalPages || totalPages === 0}
       className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-100 disabled:opacity-30 enabled:hover:bg-slate-50"
      >
       <ChevronRight size={16} />
      </button>
     </div>
    </div>
   {/* User Modal (Add/Edit) */}
   {showModal && (
    <UserModal 
     user={editingUser}
     packages={packages}
     onClose={() => { setShowModal(false); setEditingUser(null); }} 
     onSuccess={() => {
      setShowModal(false);
      setEditingUser(null);
      fetchData();
     }} 
    />
   )}
  </div>
 );
}

function UserModal({ user, packages, onClose, onSuccess }) {
 const [loading, setLoading] = useState(false);
 const isEdit = !!user;

 const [formData, setFormData] = useState({
  displayName: user?.displayName || '',
  company: user?.company || '',
  address: user?.address || '',
  country: user?.country || 'United States',
  phone: user?.phone || '',
  email: user?.email || '',
  password: '', // Password is not editable in this view
  role: user?.role || 'operator',
  status: user?.status || 'active',
  packageId: user?.packageId || 'starter-pack'
 });

 const { resetPassword, registerUser } = useAuth();
 
 const handleResetPassword = async () => {
  if (window.confirm(`System Protocol: Are you sure you want to trigger a password reset for ${formData.displayName}?`)) {
   try {
    setLoading(true);
    await resetPassword(formData.email);
    alert(`Reset Protocol Initiated: A recovery transtask has been dispatched to ${formData.email}.`);
   } catch (err) {
    console.error(err);
    alert('Critical Error: Failed to initiate reset protocol.');
   } finally {
    setLoading(false);
   }
  }
 };

 async function handleSubmit(e) {
  e.preventDefault();
  try {
   setLoading(true);
   if (isEdit) {
    await userService.updateUserProfile(user.id, {
     displayName: formData.displayName,
     role: formData.role,
     company: formData.company,
     address: formData.address,
     country: formData.country,
     phone: formData.phone,
     status: formData.status,
     packageId: formData.packageId
    });
   } else {
    // Create Auth User first
    const authUser = await registerUser(formData.email, formData.password);
    
    // Use the uid from Auth to create Firestore profile
    await userService.createUserProfile(authUser.uid, {
     displayName: formData.displayName,
     email: formData.email,
     role: formData.role,
     company: formData.company,
     address: formData.address,
     country: formData.country,
     phone: formData.phone,
     packageId: formData.packageId,
     status: 'active'
    });
   }
   onSuccess();
  } catch (err) {
   console.error(err);
   alert(`Deployment Failed: ${err.message || 'Error creating personnel identity.'}`);
  } finally {
   setLoading(false);
  }
 }

 return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
   <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
   
   <div className="bg-white max-w-2xl w-full rounded-[2rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
    <header className="p-8 pb-4 flex items-center justify-between">
     <div>
      <h1 className="text-3xl font-black text-slate-900 ">
       {isEdit ? 'Update Personnel' : 'Add New User'}
      </h1>
      <p className="text-slate-500 font-medium text-sm mt-1">
       Configure operative profile, credentials, and access levels.
      </p>
     </div>
     <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
      <X size={24} />
     </button>
    </header>

    <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
     {/* Section 1: User Information */}
     <div className="space-y-6">
      <div className="flex items-center gap-3">
       <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        <User size={20} strokeWidth={2.5} />
       </div>
       <h2 className="text-xl font-black text-slate-800 ">User Information</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
        <input 
         required
         placeholder="e.g. Sarah Connor"
         value={formData.displayName}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
         onChange={(e) => setFormData({...formData, displayName: e.target.value})}
        />
       </div>
       <div className="space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Company</label>
        <input 
         placeholder="Clawforce Industries"
         value={formData.company}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
         onChange={(e) => setFormData({...formData, company: e.target.value})}
        />
       </div>
       <div className="md:col-span-2 space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Address</label>
        <input 
         placeholder="Sector 7G, Industrial Way"
         value={formData.address}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
         onChange={(e) => setFormData({...formData, address: e.target.value})}
        />
       </div>
       <div className="space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Country</label>
        <input 
         placeholder="United States"
         value={formData.country}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
         onChange={(e) => setFormData({...formData, country: e.target.value})}
        />
       </div>
       <div className="space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone</label>
        <input 
         placeholder="+1 (555) 000-0000"
         value={formData.phone}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
         onChange={(e) => setFormData({...formData, phone: e.target.value})}
        />
       </div>
      </div>
     </div>

     {/* Section 2: Credentials */}
     <div className="space-y-6">
      <div className="flex items-center gap-3">
       <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        <Lock size={20} strokeWidth={2.5} />
       </div>
       <h2 className="text-xl font-black text-slate-800 ">Login Credentials</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
       <div className="space-y-1">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
        <input 
         required
         type="email"
         disabled={isEdit}
         placeholder="s.connor@clawforce.com"
         value={formData.email}
         className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300 disabled:opacity-50"
         onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
       </div>
       {!isEdit && (
        <div className="space-y-1 relative">
         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Password</label>
         <div className="relative">
          <input 
           required
           type="password"
           placeholder="••••••••"
           className="w-full border-b border-slate-200 py-3 focus:outline-none focus:border-emerald-600 transition-colors font-medium text-slate-900 placeholder:text-slate-300"
           onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
         </div>
        </div>
       )}
       {isEdit && (
        <div className="space-y-3">
         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Security Protocol</label>
         <button
          type="button"
          onClick={handleResetPassword}
          className="flex items-center gap-2 px-6 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all w-fit"
         >
          <Key size={14} />
          Reset Operative Password
         </button>
        </div>
       )}
      </div>
     </div>

     {/* Section 3: Access */}
     <div className="space-y-6">
      <div className="flex items-center gap-3">
       <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        <Shield size={20} strokeWidth={2.5} />
       </div>
       <h2 className="text-xl font-black text-slate-800 ">Access & Status</h2>
      </div>
      
      <div className="space-y-6">
       <div className="flex items-center gap-4">
        {['operator', 'admin'].map((role) => (
         <button
          key={role}
          type="button"
          onClick={() => setFormData({...formData, role})}
          className={cn(
           "flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all text-sm font-bold",
           formData.role === role 
            ? "bg-emerald-800 text-white border-emerald-800 shadow-lg shadow-emerald-800/10"
            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
          )}
         >
          <div className={cn(
           "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
           formData.role === role ? "border-white bg-emerald-600" : "border-slate-200"
          )}>
           {formData.role === role && <Check size={12} strokeWidth={4} />}
          </div>
          <span className="capitalize">{role} Clearance</span>
         </button>
        ))}
       </div>
       
       <div className="space-y-4">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
         <Building size={12} /> Assign Operative Tier (Package)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
         {packages.map((pkg) => (
          <button
           key={pkg.id}
           type="button"
           onClick={() => setFormData({...formData, packageId: pkg.id})}
           className={cn(
            "flex items-center gap-3 p-4 rounded-2xl border transition-all text-sm font-bold",
            formData.packageId === pkg.id 
             ? "bg-slate-900 text-white border-slate-900 shadow-lg"
             : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
           )}
          >
           <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            formData.packageId === pkg.id ? "border-white bg-emerald-600" : "border-slate-200"
           )}>
            {formData.packageId === pkg.id && <Check size={12} strokeWidth={4} />}
           </div>
           <span className="truncate">{pkg.name}</span>
          </button>
         ))}
        </div>
       </div>

       {isEdit && (
        <div className="space-y-2">
         <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Status</label>
         <div className="flex gap-2">
          {['active', 'inactive', 'suspended'].map((status) => (
           <button
            key={status}
            type="button"
            onClick={() => setFormData({...formData, status})}
            className={cn(
             "px-4 py-2 rounded-xl text-xs font-bold border transition-all capitalize",
             formData.status === status
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
            )}
           >
            {status}
           </button>
          ))}
         </div>
        </div>
       )}
      </div>
     </div>
    </form>

    <footer className="p-8 bg-slate-50 flex items-center justify-end gap-4 border-t border-slate-100 mt-0">
     <button 
      type="button"
      onClick={onClose}
      className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
     >
      Cancel
     </button>
     <button 
      onClick={handleSubmit}
      disabled={loading}
      className="flex items-center justify-center gap-2 px-10 py-4 bg-emerald-800 text-white font-bold rounded-2xl hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-800/20 disabled:opacity-70 disabled:cursor-not-allowed"
     >
      {loading ? (
       <>
        <Loader2 className="animate-spin" size={18} />
        {isEdit ? 'Syncing...' : 'Deploying...'}
       </>
      ) : (
       isEdit ? 'Save Changes' : 'Create User'
      )}
     </button>
    </footer>
   </div>
  </div>
 );
}
