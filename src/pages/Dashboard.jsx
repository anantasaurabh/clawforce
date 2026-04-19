import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Users, ClipboardList, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Total Agents', value: '12', icon: Bot, color: 'bg-emerald-500' },
  { label: 'Active Personnel', value: '8', icon: Users, color: 'bg-blue-500' },
  { label: 'Operations Today', value: '24', icon: ClipboardList, color: 'bg-amber-500' },
  { label: 'Success Rate', value: '98.5%', icon: TrendingUp, color: 'bg-purple-500' },
];

export default function Dashboard() {
  const { currentUser } = useAuth();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, Commander</h2>
          <p className="text-slate-500">Here's what's happening across Clawforce HQ today.</p>
        </div>
        <button 
          onClick={async () => {
             const { seedDatabase } = await import('../utils/seedData');
             try {
               await seedDatabase();
               alert('Database Seeded Successfully!');
             } catch (e) {
               console.error(e);
               alert('Error seeding database: ' + e.message);
             }
          }}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all border border-slate-700"
        >
          Seed Database
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-md ${stat.color} text-white`}>
                <stat.icon size={20} />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 font-display">Active Operations</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Operation #OP-042{i}</h4>
                    <p className="text-xs text-slate-500">Agent: Neural Optimizer • Started 2h ago</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                  In Progress
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Alerts</h3>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm">
              <p className="font-bold">Configuration Required</p>
              <p className="text-xs mt-1">LinkedIn Manager agent requires new API credentials.</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 text-sm">
              <p className="font-bold">New Operative Joined</p>
              <p className="text-xs mt-1">Marcus Thorne was added to the Taskforce.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
