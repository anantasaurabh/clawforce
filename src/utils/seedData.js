import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/dbPaths';

export const seedDatabase = async () => {
  const batch = writeBatch(db);

  // 1. Initial Categories
  const categories = [
    { id: 'marketing', label: 'Marketing & Social', color: 'bg-emerald-500' },
    { id: 'coding', label: 'Development & Ops', color: 'bg-blue-600' },
    { id: 'writing', label: 'Content Strategy', color: 'bg-amber-500' },
    { id: 'research', label: 'Market Research', color: 'bg-purple-600' },
    { id: 'analytics', label: 'Data Analytics', color: 'bg-cyan-500' },
    { id: 'security', label: 'Cyber Security', color: 'bg-red-600' }
  ];

  categories.forEach(cat => {
    const ref = doc(db, COLLECTIONS.CATEGORIES, cat.id);
    batch.set(ref, { label: cat.label, color: cat.color });
  });

  // 2. Initial Packages
  const packages = [
    { 
      id: 'starter-pack', 
      name: 'Standard Analyst', 
      allowedAgentIds: ['linkedin-manager', 'email-drafter', 'data-entry'],
      maxConcurrentTasks: 2
    },
    { 
      id: 'enterprise-elite', 
      name: 'Elite Operative', 
      allowedAgentIds: ['linkedin-manager', 'email-drafter', 'python-coder', 'research-pro', 'security-auditor', 'analytics-genius'],
      maxConcurrentTasks: 10
    },
    { 
      id: 'legacy-admin', 
      name: 'Legacy Admin', 
      allowedAgentIds: ['linkedin-manager', 'email-drafter', 'python-coder', 'research-pro', 'security-auditor', 'analytics-genius', 'core-orchestrator'],
      maxConcurrentTasks: 50
    }
  ];

  packages.forEach(pkg => {
    const ref = doc(db, COLLECTIONS.PACKAGES, pkg.id);
    batch.set(ref, { 
      name: pkg.name, 
      allowedAgentIds: pkg.allowedAgentIds,
      maxConcurrentTasks: pkg.maxConcurrentTasks
    });
  });

  // 3. Initial Agents
  const agents = [
    {
      id: 'linkedin-manager',
      name: 'LinkedIn Manager',
      description: 'Automates profile engagement and network growth management.',
      category: 'marketing',
      tier: 'basic',
      icon: 'Linkedin',
      icon: 'Linkedin'
    },
    {
      id: 'python-coder',
      name: 'Python Architect',
      description: 'Generates optimized Python modules and diagnostic scripts.',
      category: 'coding',
      tier: 'premium',
      icon: 'Code',
      icon: 'Code'
    },
    {
      id: 'research-pro',
      name: 'Market Intelligence',
      description: 'Scrapes and synthesizes market data into actionable reports.',
      category: 'research',
      tier: 'premium',
      icon: 'Search',
      icon: 'Search'
    },
    {
      id: 'email-drafter',
      name: 'Communcations Specialist',
      description: 'Drafts high-conversion emails and professional correspondence.',
      category: 'writing',
      tier: 'basic',
      icon: 'Mail',
      icon: 'Mail'
    },
    {
      id: 'security-auditor',
      name: 'Security Sentinel',
      description: 'Performs automated penetration testing and vulnerability scanning.',
      category: 'security',
      tier: 'premium',
      icon: 'Shield',
      icon: 'Shield'
    },
    {
      id: 'analytics-genius',
      name: 'Data Synthesizer',
      description: 'Visualizes complex datasets and predicts market trends.',
      category: 'analytics',
      tier: 'premium',
      icon: 'BarChart',
      icon: 'BarChart'
    }
  ];

  agents.forEach(agent => {
    const ref = doc(db, COLLECTIONS.AGENTS, agent.id);
    batch.set(ref, {
      name: agent.name,
      description: agent.description,
      category: agent.category,
      tier: agent.tier,
      icon: agent.icon
    });
  });

  // 4. Initial Users (Personnel)
  const users = [
    {
      id: 'admin-dev-001',
      displayName: 'Marcus Thorne',
      email: 'm.thorne@clawforce.hq',
      role: 'admin',
      status: 'active',
      packageId: 'enterprise-elite',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus'
    },
    {
      id: 'operator-dev-001',
      displayName: 'Elena Vance',
      email: 'elena.vance@clawforce.hq',
      role: 'operator',
      status: 'active',
      packageId: 'starter-pack',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena'
    }
  ];

  users.forEach(user => {
    const ref = doc(db, COLLECTIONS.USERS, user.id);
    batch.set(ref, {
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: user.status,
      packageId: user.packageId,
      avatar: user.avatar,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
  });

  // 5. Initial Tasks (Operational Tasks)
  const sampleTasks = [
    {
      id: 'task-001',
      title: 'LinkedIn Network Expansion - Q2',
      description: 'Expand high-value engineering network specifically targeting DevOps and Security experts in the EMEA region. Prioritize profiles with active GitHub contributions and high engagement levels.',
      agentId: 'linkedin-manager',
      ownerId: 'admin-dev-001',
      status: 'completed',
      progress: 100,
      metadata: { target_count: 50, successful_connections: 42 }
    },
    {
      id: 'task-002',
      title: 'Security Audit: Firewall Subnet A',
      description: 'Perform deep packet inspection and signature analysis across Sector 7G perimeter nodes. Identify irregular TCP/UDP traffic patterns originating from unauthorized external gateways.',
      agentId: 'security-auditor',
      ownerId: 'admin-dev-001',
      status: 'in-progress',
      progress: 65,
      metadata: { scan_depth: 'deep', vulnerabilities_found: 3 }
    },
    {
      id: 'task-003',
      title: 'Market Analysis: AI SaaS Trends',
      description: 'Aggregate and synthesize market data regarding autonomous coding assistants and agentic workflows. Focus on pricing models and multi-agent orchestration strategies mentioned in recent research papers.',
      agentId: 'research-pro',
      ownerId: 'admin-dev-001',
      status: 'enqueued',
      progress: 0,
      metadata: { sources: ['Gartner', 'TechCrunch'] }
    }
  ];

  sampleTasks.forEach(task => {
    const ref = doc(db, COLLECTIONS.TASKS, task.id);
    batch.set(ref, {
      ...task,
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
  console.log('Database seeded successfully!');
};
