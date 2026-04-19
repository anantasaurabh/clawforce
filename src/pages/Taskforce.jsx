import React, { useState, useEffect } from 'react';
import {
  Search,
  Settings2,
  Lock,
  Zap,
  Bot,
  ArrowRight,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  ShieldAlert,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { catalogService, configService, taskService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function Taskforce() {
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userConfigs, setUserConfigs] = useState({});
  const [tasks, setTasks] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  async function fetchData() {
    if (!currentUser) return;
    try {
      setLoading(true);

      // Fetch core data: Agents and Categories are critical
      // Tasks are secondary, if they fail (e.g. missing index), we still want to show agents
      const [agts, cats, pkgs] = await Promise.all([
        catalogService.getAgents(),
        catalogService.getCategories(),
        catalogService.getPackages()
      ]);

      setAgents(agts);
      setCategories(cats);
      setPackages(pkgs);

      // Attempt to fetch tasks (resiliently)
      try {
        const tskList = await taskService.getUserTasks(currentUser.uid);
        setTasks(tskList);
      } catch (tskErr) {
        console.warn('Tasks could not be loaded (Indices might still be provisioning):', tskErr);
      }

      // Fetch config status for each agent (resiliently)
      const configs = {};
      await Promise.all(agts.map(async (agent) => {
        try {
          const config = await configService.getAgentSettings(currentUser.uid, agent.id);
          configs[agent.id] = config;
        } catch (cfgErr) {
          console.warn(`Config for agent ${agent.id} could not be loaded:`, cfgErr);
        }
      }));
      setUserConfigs(configs);

    } catch (err) {
      console.error('Critical Error fetching taskforce data:', err);
    } finally {
      setLoading(false);
    }
  }

  const isAgentAccessible = (agent) => {
    if (userProfile?.role === 'admin') return true;

    // Find user's package definition
    const userPkg = packages.find(p => p.id === userProfile?.packageId);

    // 1. Check explicit ID allowance from package
    if (userPkg?.allowedAgentIds?.includes(agent.id)) return true;

    // 2. Fallback to Tier Priority check
    const tierPriority = { 'legacy': 0, 'basic': 1, 'pro': 2, 'premium': 2, 'elite': 3 };
    const userTier = (userProfile?.tier || userPkg?.tier || 'basic').toLowerCase();
    const agentTier = (agent.tier || 'basic').toLowerCase();

    // If agent tier is higher than user tier priority, it's locked
    const aPrio = tierPriority[agentTier] ?? 99; // Default to extremely locked if unknown tier
    const uPrio = tierPriority[userTier] ?? 1;

    return aPrio <= uPrio;
  };

  const filteredAgents = agents.filter(agent => {
    const matchesCategory = activeCategory === 'All' || agent.category === activeCategory;
    const matchesSearch =
      agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    const aAcc = isAgentAccessible(a);
    const bAcc = isAgentAccessible(b);

    // 1. Accessibility first (Accessible > Locked)
    if (aAcc && !bAcc) return -1;
    if (!aAcc && bAcc) return 1;

    // 2. Tier Priority next (Higher tiers first)
    const tierPriority = { 'elite': 3, 'pro': 2, 'basic': 1, 'legacy': 0 };
    const aPrio = tierPriority[(a.tier || 'basic').toLowerCase()] || 0;
    const bPrio = tierPriority[(b.tier || 'basic').toLowerCase()] || 0;
    if (bPrio !== aPrio) return bPrio - aPrio;

    // 3. Alphabetical name as tie-breaker
    return (a.name || '').localeCompare(b.name || '');
  });

  // Calculate stats for an agent
  const getAgentStats = (agentId) => {
    const agentTasks = tasks.filter(t => t.agentId === agentId);
    return {
      active: agentTasks.filter(t => ['enqueued', 'in-progress', 'waiting'].includes(t.status)).length,
      completed: agentTasks.filter(t => t.status === 'completed').length,
      attention: agentTasks.filter(t => t.status === 'failed' || t.status === 'waiting').length
    };
  };



  if (loading) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        <div className="h-20 bg-white rounded-xl w-1/3" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-10 w-24 bg-white rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-[400px] bg-white rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="space-y-4">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight">Taskforce</h1>
        <p className="text-slate-400 text-lg max-w-3xl font-medium leading-relaxed">
          Access elite autonomous agents, manage mission configurations, and scale your operational capacity.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveCategory('All')}
            className={cn(
              "px-1 mx-2 py-2 text-sm font-bold transition-all whitespace-nowrap border-b-4",
              activeCategory === 'All'
                ? "text-slate-900 border-brand-primary/90"
                : "text-slate-500 border-transparent hover:text-slate-700"
            )}
          >
            All Agents
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-1 mx-2 py-2 text-sm font-bold transition-all whitespace-nowrap border-b-4",
                activeCategory === cat.id
                  ? "text-slate-900 border-brand-primary/90"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative group w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search agents by protocol or capabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 focus:border-brand-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
        {filteredAgents.map((agent, index) => {
          const config = userConfigs[agent.id];
          const hasSchema = agent.configSchema && agent.configSchema.length > 0;
          const isConfigured = !hasSchema || config?.isConfigured;
          const accessible = isAgentAccessible(agent);
          const stats = getAgentStats(agent.id);
          const cat = categories.find(c => c.id === agent.category);

          return (
            <div
              key={agent.id}
              onClick={() => accessible && navigate(`/agent/${agent.id}`)}
              className={cn(
                "group bg-white rounded-2xl border border-slate-200 hover:shadow-xl transition-all duration-500 flex flex-col relative overflow-hidden",
                accessible ? "cursor-pointer hover:border-brand-primary/20" : "opacity-80"
              )}
            >
              {!accessible && (
                <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden rounded-tr-2xl z-30">
                  <div className="absolute top-3 right-[-30px] w-32 py-2 bg-amber-700 text-white text-[10px] font-black uppercase tracking-[0.2em] text-center rotate-45 shadow-lg">
                    Upgrade
                  </div>
                </div>
              )}
              {/* Agent ID and Settings Icon */}
              <div className="absolute top-6 left-8 text-[10px] font-black text-slate-200 uppercase tracking-widest">
                {String(index + 1).padStart(2, '0')}
              </div>


              <div className="p-8 pt-12 flex flex-col items-center text-center flex-1 relative">
                {/* Restricted Overlay (Locked) */}
                {!accessible && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px]">
                    <div className="w-14 h-14 bg-amber-700 rounded-full flex items-center justify-center shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-300">
                      <Lock className="text-white" size={24} />
                    </div>
                  </div>
                )}

                {/* Avatar area */}
                <div className="relative mb-6">
                  <div className={cn(
                    "transition-transform duration-500 group-hover:scale-105 p-1.5",
                    agent.imageUrl ? "w-32 h-44" : "w-32 h-32",
                    accessible ? "" : "bg-slate-50 grayscale"
                  )}>
                    <div className={cn(
                      "w-full h-full overflow-hidden relative bg-slate-50",
                      agent.imageUrl ? "rounded-2xl" : "rounded-full"
                    )}>
                      <img
                        src={agent.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.id}&backgroundColor=f8fafc`}
                        alt={agent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{cat?.label || agent.category}</span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-brand-primary transition-colors">{agent.name}</h3>
                </div>

                <p className="text-slate-500 text-sm leading-relaxed font-medium line-clamp-2 mb-8 px-2">
                  {agent.description}
                </p>

                {/* Stats */}
                <div className="w-full grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Active</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{stats.active}</p>
                  </div>
                  <div className="text-center border-x border-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Completed</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">{stats.completed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Attention</p>
                    <p className={cn("text-lg font-black tracking-tight", stats.attention > 0 ? "text-red-500" : "text-slate-900")}>
                      {stats.attention}
                    </p>
                  </div>
                </div>


              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
