import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
 return twMerge(clsx(inputs));
}

export default function Login() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const { login, mockLogin } = useAuth();
 const navigate = useNavigate();

 async function handleSubmit(e) {
  e.preventDefault();

  try {
   setError('');
   setLoading(true);
   
   // Try real login first
   const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
   const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

   if (email !== adminEmail) {
    await login(email, password);
    navigate('/');
    return;
   }

   // Handle Mock Login
   if (email === adminEmail && password === adminPassword) {
    mockLogin();
    navigate('/');
   } else {
    setError('Invalid Security Key for Super Admin identity.');
   }
  } catch (err) {
   setError('Authorization failed. Please verify your personnel credentials.');
   console.error(err);
   
   // MOCK LOGIN FOR DEVELOPMENT (Since .env might be missing)
   if (email === 'admin@clawforce.hq' && password === 'admin123') {
    // This is just to let the user see the dashboard during development
    // if they don't have Firebase keys set up yet.
    console.warn('Using dev mock login');
    navigate('/');
   }
  } finally {
   setLoading(false);
  }
 }

 return (
  <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4 font-sans selection:bg-emerald-100 selection:text-emerald-900">
   <div className="max-w-[440px] w-full">
    {/* Logo Section */}
    <div className="flex flex-col items-center mb-10">
     <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-200/50 mb-6 transition-transform hover:scale-105 duration-300">
      <ShieldCheck size={40} className="text-white" strokeWidth={1.5} />
     </div>
     <h1 className="text-4xl font-black text-slate-900 leading-none mb-2">
      Clawforce <span className="text-emerald-600">HQ</span>
     </h1>
     <p className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">
      Task Control Management Suite
     </p>
    </div>

    {/* Login Card */}
    <div className="bg-white p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100/80 relative overflow-hidden group">
     {/* Subtle Accent Line */}
     <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
     
     <div className="mb-8">
      <h2 className="text-2xl font-bold text-slate-800">Command Access</h2>
      <p className="text-slate-500 text-sm mt-1">Provide your personnel identity to enter the control plane.</p>
     </div>
     
     {error && (
      <div className="mb-6 p-4 rounded-2xl bg-red-50/50 border border-red-100 flex items-start gap-3 text-red-700 text-sm leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
       <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-500" />
       <p>{error}</p>
      </div>
     )}

     <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
       <label 
        className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1" 
        htmlFor="email"
       >
        Personnel ID (Email)
       </label>
       <div className="relative group/field">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within/field:text-emerald-500 transition-colors">
         <Mail size={18} strokeWidth={2} />
        </div>
        <input
         id="email"
         type="email"
         required
         className="block w-full pl-11 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.25rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all sm:text-sm font-medium"
         placeholder="name@clawforce.hq"
         value={email}
         onChange={(e) => setEmail(e.target.value)}
        />
       </div>
      </div>

      <div className="space-y-2">
       <div className="flex justify-between items-center ml-1">
        <label 
         className="block text-xs font-bold text-slate-400 uppercase tracking-widest" 
         htmlFor="password"
        >
         Security Key
        </label>
        <button type="button" className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-wider">
         Forgot?
        </button>
       </div>
       <div className="relative group/field">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within/field:text-emerald-500 transition-colors">
         <Lock size={18} strokeWidth={2} />
        </div>
        <input
         id="password"
         type="password"
         required
         className="block w-full pl-11 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.25rem] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white transition-all sm:text-sm font-medium"
         placeholder="••••••••"
         value={password}
         onChange={(e) => setPassword(e.target.value)}
        />
       </div>
      </div>

      <button
       type="submit"
       disabled={loading}
       className={cn(
        "w-full flex items-center justify-center px-4 py-4 border border-transparent text-sm font-bold rounded-[1.25rem] text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-emerald-600/20 transition-all shadow-lg shadow-emerald-600/20 mt-2",
        loading && "opacity-70 cursor-not-allowed"
       )}
      >
       {loading ? (
        <>
         <Loader2 className="animate-spin mr-2" size={20} strokeWidth={3} />
         Authorizing Personnel...
        </>
       ) : (
        "Authorize Access"
       )}
      </button>
     </form>
    </div>

    {/* Footer info */}
    <div className="mt-10 flex flex-col items-center gap-4">
     <p className="text-center text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
      Controlled Environment • Level 4 Clearance Required
     </p>
     <div className="flex items-center gap-6">
      <span className="w-8 h-[1px] bg-slate-200"></span>
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
      <span className="w-8 h-[1px] bg-slate-200"></span>
     </div>
    </div>
   </div>
  </div>
 );
}
