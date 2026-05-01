import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { configService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const alertStyles = {
  success: "bg-emerald-50 border-emerald-100 text-emerald-800",
  error: "bg-red-50 border-red-100 text-red-800",
  warning: "bg-amber-50 border-amber-100 text-amber-800",
  info: "bg-blue-50 border-blue-100 text-blue-800",
};

const alertIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function GlobalAlert() {
  const { currentUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [superAgentImage, setSuperAgentImage] = useState('');

  useEffect(() => {
    const unsub = configService.subscribeGlobalVars(vars => {
      if (vars.SUPER_AGENT_IMAGE) setSuperAgentImage(vars.SUPER_AGENT_IMAGE);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const checkData = (data) => {
      setAlerts(prev => {
        const otherAlerts = prev.filter(a => a.id !== 'icp-warning');
        if (!data.companyInfo || !data.icp) {
          return [
            ...otherAlerts,
            {
              id: 'icp-warning',
              type: 'warning',
              title: 'Company Identity Missing',
              message: 'Please complete your company information and generate an Ideal Customer Profile (ICP) for better agent performance.',
              link: '/settings#my-company',
              linkText: 'Configure Identity'
            }
          ];
        }
        return otherAlerts;
      });
    };

    // Real-time listener for ICP status
    const unsub = onSnapshot(doc(db, `artifacts/clwhq-001/userConfigs`, currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        checkData(snapshot.data());
      } else {
        // Doc might not exist yet, check via service which handles defaults
        configService.getCompanyInfo(currentUser.uid).then(checkData);
      }
    });

    return () => unsub();
  }, [currentUser]);

  const dismissAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="px-10 pb-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
      {alerts.map((alert) => {
        const Icon = alertIcons[alert.type];
        return (
          <div 
            key={alert.id}
            className={cn(
              "p-4 rounded-2xl border flex items-center gap-4 relative overflow-hidden",
              alertStyles[alert.type]
            )}
          >
            {/* Subtle side accent */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-1",
              alert.type === 'success' && "bg-emerald-400",
              alert.type === 'error' && "bg-red-400",
              alert.type === 'warning' && "bg-amber-400",
              alert.type === 'info' && "bg-blue-400",
            )} />

            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-black/5 overflow-hidden bg-slate-100",
            )}>
              {superAgentImage ? (
                <img src={superAgentImage} alt="AI Agent" className="w-full h-full object-cover" />
              ) : (
                <Icon size={20} className="opacity-40" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-black text-sm uppercase tracking-wider">{alert.title}</p>
              <p className="text-sm font-medium opacity-80 truncate">{alert.message}</p>
            </div>

            <div className="flex items-center gap-4">
              {alert.link && (
                <Link 
                  to={alert.link}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/50 hover:bg-white transition-all text-xs font-black uppercase tracking-widest shadow-sm border border-black/5"
                >
                  {alert.linkText || 'Action'}
                  <ArrowRight size={14} />
                </Link>
              )}

              <button 
                onClick={() => dismissAlert(alert.id)}
                className="p-2 hover:bg-black/5 rounded-lg transition-colors opacity-40 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
