import React, { useState } from 'react';
import { X, User, Lock, Camera, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';
import { cn } from '../utils/cn'; // Assuming there's a cn utility, or I'll define it locally

export default function ProfileModal({ isOpen, onClose }) {
  const { currentUser, userProfile, updateProfileData, updatePassword } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await updatePassword(newPassword);
      }

      await updateProfileData({ displayName });
      setStatus({ type: 'success', message: 'Profile updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setStatus(null);

    try {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      await updateProfileData({ photoURL });
      setStatus({ type: 'success', message: 'Avatar updated!' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to upload image' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <header className="p-8 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">User Profile</h2>
            <p className="text-slate-500 font-medium text-xs mt-1">Manage your identity and security.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-slate-900">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleUpdateProfile} className="p-8 pt-4 space-y-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-slate-100 overflow-hidden border-4 border-white shadow-xl">
                {uploading ? (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                ) : (
                  <img 
                    src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.uid}`} 
                    alt="profile" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 p-2 bg-slate-900 text-white rounded-xl shadow-lg cursor-pointer hover:scale-110 transition-transform">
                <Camera size={16} />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click camera to upload</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Display Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border-none px-12 py-4 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-brand-primary/20 transition-all"
                  placeholder="Your Name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
              <input
                type="email"
                value={currentUser?.email || ''}
                disabled
                className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={14} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-brand-primary/20 transition-all text-sm"
                />
                <input
                  type="password"
                  placeholder="Confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border-none px-6 py-4 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-brand-primary/20 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {status && (
            <div className={cn(
              "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2",
              status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            )}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <p className="text-xs font-bold">{status.message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
