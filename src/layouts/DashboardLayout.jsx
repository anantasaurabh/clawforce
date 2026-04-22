import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { catalogService } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';
import ProfileModal from '../components/ProfileModal';
import { 
 LayoutDashboard, 
 Users, 
 Bot, 
 ClipboardList, 
 Settings, 
 HelpCircle, 
 LogOut,
 Bell,
 Search,
 Plus,
 Grid,
 Package,
 Globe
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
 return twMerge(clsx(inputs));
}

const navItems = [
 { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
 { icon: Grid, label: 'Taskforce', path: '/taskforce' },
 { icon: ClipboardList, label: 'Taskboard', path: '/taskboard' },
];

const adminItems = [
 { icon: Users, label: 'Users', path: '/users' },
 { icon: Bot, label: 'Agents', path: '/agents' },
 { icon: Globe, label: 'Global Variables', path: '/global-vars' },
 { icon: Grid, label: 'Categories', path: '/categories' },
 { icon: Package, label: 'Packages', path: '/packages' },
];

const bottomItems = [
 { icon: Settings, label: 'Settings', path: '/settings' },
 { icon: HelpCircle, label: 'Help', path: '/help' },
];

export default function DashboardLayout() {
 const { currentUser, userProfile, logout, isAdmin } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const [isSidebarOpen, setIsSidebarOpen] = useState(true);
 const [activeAgentName, setActiveAgentName] = useState('');
 const [showProfileModal, setShowProfileModal] = useState(false);

 // Fetch active agent name for breadcrumbs
 React.useEffect(() => {
  const segments = location.pathname.split('/').filter(p => p);
  if (segments[0] === 'agent' && segments[1]) {
   catalogService.getAgents().then(agents => {
    const agent = agents.find(a => a.id === segments[1]);
    if (agent) setActiveAgentName(agent.name);
   });
  } else {
   setActiveAgentName('');
  }
 }, [location.pathname]);

 const getBreadcrumbs = () => {
  const paths = location.pathname.split('/').filter(p => p);
  return paths;
 };

 const pathLabels = {
  'taskforce': 'Taskforce',
  'taskboard': 'Task Command',
  'agent': 'Taskforce',
  'users': 'Personnel Management',
  'agents': 'Core Registry',
  'categories': 'Protocol Categories',
  'packages': 'Security Packages',
  'global-vars': 'Global Protocol Variables',
  'settings': 'System Settings',
  'help': 'Support Center'
 };

 async function handleLogout() {
  try {
   await logout();
   navigate('/login');
  } catch (err) {
   console.error('Failed to logout', err);
  }
 }

 return (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
   {/* Sidebar */}
   <aside className={cn(
    "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col",
    isSidebarOpen ? "w-64" : "w-20"
   )}>
    <div className="p-6 flex items-center gap-3">
     <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center text-white shrink-0">
      <Bot size={24} />
     </div>
     {isSidebarOpen && (
      <div className="overflow-hidden">
       <h1 className="font-bold text-slate-900 truncate">Clawforce HQ</h1>
       <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">Management Suite</p>
      </div>
     )}
    </div>

    <nav className="flex-1 px-4 space-y-1 mt-4">
     {navItems.map((item) => (
      <NavLink
       key={item.path}
       to={item.path}
       className={({ isActive }) => cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm",
        isActive 
         ? "bg-brand-primary/10 text-brand-primary" 
         : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
       )}
      >
       <item.icon size={20} />
       {isSidebarOpen && <span>{item.label}</span>}
      </NavLink>
     ))}

     {isAdmin && (
      <div className="py-4">
       {isSidebarOpen && <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-3 mb-2">Administration</p>}
       <div className="h-px bg-slate-100 mx-3 mb-3" />
       {adminItems.map((item) => (
        <NavLink
         key={item.path}
         to={item.path}
         className={({ isActive }) => cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm",
          isActive 
           ? "bg-brand-primary/10 text-brand-primary" 
           : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
         )}
        >
         <item.icon size={20} />
         {isSidebarOpen && <span>{item.label}</span>}
        </NavLink>
       ))}
      </div>
     )}
    </nav>

    <div className="p-4 border-t border-slate-100 space-y-1">
     {bottomItems.map((item) => (
      <NavLink
       key={item.path}
       to={item.path}
       className={({ isActive }) => cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors font-medium text-sm",
        isActive 
         ? "bg-slate-900 text-white shadow-lg" 
         : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
       )}
      >
       <item.icon size={20} />
       {isSidebarOpen && <span>{item.label}</span>}
      </NavLink>
     ))}
     <button
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors font-medium text-sm"
     >
      <LogOut size={20} />
      {isSidebarOpen && <span>Sign Out</span>}
     </button>
    </div>
   </aside>

   {/* Main Content */}
   <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
    {/* Header */}
    <header className="h-20 flex items-center justify-between px-10 shrink-0 z-10">
     <div className="flex-1 flex items-center gap-2">
      <Link to="/" className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
       Platform
      </Link>
      {getBreadcrumbs().map((path, idx) => {
       const isAgentId = idx === 1 && getBreadcrumbs()[0] === 'agent';
       const label = isAgentId ? activeAgentName : (pathLabels[path] || path);
       const isLast = idx === getBreadcrumbs().length - 1;
       
       if (isAgentId && !activeAgentName) return null; // Wait for name to load

       // Determine the URL for this breadcrumb segment
       let segmentPath = '';
       if (path === 'agent') segmentPath = '/taskforce';
       else if (idx === 0) segmentPath = `/${path}`;
       // We don't link the agent ID directly, it's usually the last segment

       return (
        <React.Fragment key={path}>
         <span className="text-slate-300">/</span>
         {isLast || !segmentPath ? (
          <span className={cn(
           "text-sm font-bold ",
           isLast ? "text-slate-900" : "text-slate-400"
          )}>
           {label}
          </span>
         ) : (
          <Link 
           to={segmentPath}
           className="text-sm font-bold text-slate-400 hover:text-brand-primary transition-colors"
          >
           {label}
          </Link>
         )}
        </React.Fragment>
       );
      })}
     </div>

     <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
       <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all relative">
        <Bell size={20} />
        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
       </button>
       <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
        <Settings size={20} />
       </button>
      </div>
       <div className="h-8 w-px bg-slate-100" />
       <button 
         onClick={() => setShowProfileModal(true)}
         className="flex items-center gap-3 pl-2 group transition-all"
       >
        <div className="hidden md:flex flex-col items-end mr-1">
         <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest leading-none mb-0.5">
           {userProfile?.displayName || "Operator"}
         </span>
         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none">
           {userProfile?.role || "Member"}
         </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm flex-shrink-0 group-hover:border-brand-primary transition-all">
         <img src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.uid || "admin"}`} alt="avatar" />
        </div>
       </button>

       <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
     </div>
    </header>

    {/* Page Content */}
    <div className="flex-1 overflow-y-auto p-8 bg-[#F8FAFC]">
     <Outlet />
    </div>
   </main>
  </div>
 );
}
