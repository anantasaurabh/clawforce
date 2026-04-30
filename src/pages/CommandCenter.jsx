import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { commandCenterService, missionService, catalogService, taskService } from '../services/firestore';
import { Rocket, Send, Plus, Check, AlertCircle, RefreshCw, MessageSquare, Trash2 } from 'lucide-react';
import MissionDetails from '../components/MissionDetails';

export default function CommandCenter() {
  const { currentUser, isAdmin } = useAuth();
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [missions, setMissions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab management state (admin)
  // Moved to CommandCenterConfig

  // Mission creation state
  const [missionInput, setMissionInput] = useState('');
  const [missionParams, setMissionParams] = useState({});
  const [approvePlan, setApprovePlan] = useState(true);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);

  // Selected mission state
  const [selectedMission, setSelectedMission] = useState(null);
  const [missionToDelete, setMissionToDelete] = useState(null);
  const [deleteTasks, setDeleteTasks] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Mission comments state
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [tabsData, agentsData] = await Promise.all([
          commandCenterService.getTabs(),
          catalogService.getAgents()
        ]);
        setTabs(tabsData);
        setAgents(agentsData);
        if (tabsData.length > 0) setActiveTab(tabsData[0]);
      } catch (err) {
        console.error("Failed to load command center static data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();

    // Real-time subscription for missions (strictly owned by current user)
    const unsubscribe = missionService.subscribeMissions((missionsData) => {
      const userMissions = missionsData.filter(m => m.ownerId === currentUser?.uid);
      setMissions(userMissions);
    }, currentUser?.uid);

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  const handleCreateMission = async () => {
    if (!missionInput.trim() || !activeTab) return;

    setIsCreating(true);
    try {
      const newMissionId = await missionService.createMission(currentUser.uid, {
        title: missionInput,
        metadata: missionParams,
        tab_slug: activeTab.slug || activeTab.name.toLowerCase(),
        tab_id: activeTab.id,
        approvePlanBeforeLaunch: approvePlan,
        autoPilotMode: autoPilot,
        plan_doc: '# Generating Plan...\n\nThe orchestrator is currently analyzing your request and generating an execution plan.'
      });

      const newMission = {
        id: newMissionId,
        title: missionInput,
        metadata: missionParams,
        tab_slug: activeTab.slug || activeTab.name.toLowerCase(),
        tab_id: activeTab.id,
        approvePlanBeforeLaunch: approvePlan,
        autoPilotMode: autoPilot,
        ownerId: currentUser.uid,
        status: 'Planning',
        createdAt: new Date(),
        plan_doc: '# Generating Plan...\n\nThe orchestrator is currently analyzing your request and generating an execution plan.'
      };

      setMissions([newMission, ...missions]);
      setMissionInput('');
      setMissionParams({});
      setShowMissionForm(false);
      setSelectedMission(newMission);
    } catch (err) {
      console.error("Failed to create mission:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleMissionRestart = async (missionId) => {
    try {
      const updatedData = {
        status: 'Planning',
        plan_doc: '# Generating Plan...\n\nThe orchestrator is currently analyzing your request and generating an execution plan.',
        error: null,
        progress: 0
      };
      await missionService.updateMission(missionId, updatedData);

      // If the currently viewed mission is the one being restarted, update it in selection state
      if (selectedMission && selectedMission.id === missionId) {
        setSelectedMission(prev => ({ ...prev, ...updatedData }));
      }
    } catch (err) {
      console.error("Failed to restart mission:", err);
    }
  };

  const handleDeleteMission = async () => {
    if (!missionToDelete) return;
    setIsDeleting(true);
    try {
      if (deleteTasks) {
        const associatedTasks = await taskService.getMissionTasks(missionToDelete.id);
        for (const task of associatedTasks) {
          await taskService.deleteTask(task.id);
        }
      }
      await missionService.deleteMission(missionToDelete.id);
      // If deleted mission was selected, unselect it
      if (selectedMission && selectedMission.id === missionToDelete.id) {
        setSelectedMission(null);
      }
    } catch (err) {
      console.error("Failed to delete mission:", err);
    } finally {
      setIsDeleting(false);
      setMissionToDelete(null);
    }
  };

  // Subscribe to comments when a mission is selected
  useEffect(() => {
    if (!selectedMission?.id) {
      setComments([]);
      return;
    }
    const unsubscribe = missionService.subscribeComments(selectedMission.id, (newComments) => {
      setComments(newComments);
    });
    return () => unsubscribe();
  }, [selectedMission?.id]);

  // Auto-scroll comments to bottom
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || isSendingComment || !selectedMission) return;
    setIsSendingComment(true);
    try {
      await missionService.addComment(
        selectedMission.id,
        'user',
        commentInput,
        currentUser?.displayName || currentUser?.email
      );
      setCommentInput('');
    } catch (err) {
      console.error('Error sending comment:', err);
    } finally {
      setIsSendingComment(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Planning': return 'text-amber-500 bg-amber-50';
      case 'WaitingApproval': return 'text-purple-500 bg-purple-50';
      case 'Waiting': return 'text-orange-500 bg-orange-50';
      case 'In-Progress': return 'text-blue-500 bg-blue-50';
      case 'Completed': return 'text-green-500 bg-green-50';
      case 'Rejected': return 'text-red-500 bg-red-50';
      case 'Failed': return 'text-rose-500 bg-rose-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><RefreshCw className="animate-spin text-brand-primary" size={24} /></div>;
  }

  const activeTabMissions = missions.filter(m => m.tab_id === activeTab?.id || (m.tab_slug && m.tab_slug === activeTab?.slug));

  return (
    <div className="space-y-2">
      <header className="space-y-4">
        <h1 className="text-5xl font-black text-slate-900 flex items-center gap-3">
          <Rocket className="text-brand-primary" /> Command Center
        </h1>
        <p className="text-slate-400 text-lg max-w-3xl font-medium leading-relaxed">
          Coordinate deployments, monitor cross-agent workflows, and initialize automated strategies.
        </p>
      </header>

      <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs Header */}
        <div className="flex items-center gap-2 px-6 pt-2 border-b border-slate-200 bg-slate-50 overflow-x-auto">
          <div className="flex gap-1 flex-1 whitespace-nowrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab); setSelectedMission(null); setShowMissionForm(false); }}
                className={`flex items-center gap-2.5 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab?.id === tab.id
                  ? 'border-brand-primary text-brand-primary bg-white/80 rounded-t-xl shadow-sm'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300/40 flex items-center justify-center text-slate-500 text-[10px] font-bold overflow-hidden flex-shrink-0">
                  {tab.avatar ? (
                    <img src={tab.avatar} alt={tab.name} className="w-full h-full object-cover" />
                  ) : (
                    tab.name.charAt(0)
                  )}
                </div>
                <span>{tab.name}</span>
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => window.location.href = '/command-center-config'}
                className="px-3 py-2 text-slate-400 hover:text-brand-primary transition-colors self-center"
                title="Configure Commanders"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Pane - Comments when mission selected, otherwise Mission Creator */}
          <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-slate-200 flex flex-col bg-slate-50 bg-white">
            {selectedMission ? (
              /* ── Comments Panel ── */
              <div className="flex flex-col h-full">
                <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center gap-2">
                  <MessageSquare size={15} className="text-brand-primary" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Mission Chat</h3>
                </div>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {comments.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                      <MessageSquare size={24} className="text-slate-200" />
                      <p className="text-xs font-medium">No messages yet.</p>
                      <p className="text-xs text-center leading-relaxed">Ask the agent a question or provide additional context here.</p>
                    </div>
                  )}
                  {comments.map(comment => (
                    <div key={comment.id} className={`flex flex-col gap-1 ${comment.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {comment.role === 'user' ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {comment.authorName || 'You'}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {activeTab?.avatar ? (
                              <img src={activeTab.avatar} alt={activeTab.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] font-bold text-slate-500">{activeTab?.name?.charAt(0)}</span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {activeTab?.name || 'Commander'}
                          </span>
                        </div>
                      )}
                      <div className={`max-w-[90%] px-3 py-2 rounded-xl text-sm leading-relaxed ${comment.role === 'user'
                        ? 'bg-brand-primary text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                        }`}>
                        {comment.content}
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
                {/* Input */}
                {(missions.find(m => m.id === selectedMission.id)?.status || selectedMission?.status) === 'Completed' ? (
                  <div className="p-4 border-t border-slate-200 bg-slate-100/80 text-center text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    Mission Completed — Chat Locked
                  </div>
                ) : (
                  <form onSubmit={handleSendComment} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                    <input
                      type="text"
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      placeholder="Message the agent..."
                      className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!commentInput.trim() || isSendingComment}
                      className="p-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                      <Send size={15} />
                    </button>
                  </form>
                )}
              </div>
            ) : !showMissionForm ? (
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
                {activeTab && (
                  <div className="flex flex-col items-center max-w-md">
                    <div className="w-60 h-80 rounded-3xl bg-slate-200 border-slate-300/40 flex items-center justify-center text-slate-500 font-bold text-4xl overflow-hidden flex-shrink-0 mb-6 animate-in fade-in zoom-in-95 duration-500">
                      {activeTab.avatar ? (
                        <img src={activeTab.avatar} alt={activeTab.name} className="w-full h-full object-cover" />
                      ) : (
                        activeTab.name.charAt(0)
                      )}
                    </div>
                    {/* <h3 className="text-2xl font-black text-slate-900 mb-2">{activeTab.name}</h3> */}
                    {activeTab.description ? (
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed mb-8">{activeTab.description}</p>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1 italic mb-8">No profile description set for this commander.</p>
                    )}

                    <style>{`
                      @keyframes borderGlow {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                      }
                    `}</style>

                    <button
                      onClick={() => setShowMissionForm(true)}
                      className="relative group overflow-hidden p-[2px] rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.45)] transition-all duration-500"
                    >
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-2xl"
                        style={{
                          backgroundSize: '200% 200%',
                          animation: 'borderGlow 3s ease infinite'
                        }}
                      />
                      <div className="relative px-6 py-3.5 bg-white text-emerald-600 font-black rounded-[14px] uppercase tracking-widest text-xs flex items-center gap-2 group-hover:bg-emerald-50/90 transition-all duration-300">
                        <Plus size={16} className="stroke-[3px]" />
                        Create New Mission
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300/40 flex items-center justify-center text-slate-500 text-xs font-bold overflow-hidden flex-shrink-0">
                      {activeTab?.avatar ? (
                        <img src={activeTab.avatar} alt={activeTab.name} className="w-full h-full object-cover" />
                      ) : (
                        activeTab?.name?.charAt(0)
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">
                      Hey there! Describe your mission, I will come-up with plan and tasks for my team
                    </p>
                  </div>
                  <button
                    onClick={() => setShowMissionForm(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex-shrink-0 pt-1"
                  >
                    Back
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    {/* <label className="text-xs font-bold text-slate-500 uppercase">Objective</label> */}
                    <textarea
                      value={missionInput}
                      onChange={(e) => setMissionInput(e.target.value)}
                      placeholder={`E.g., "Improve website traffic by 30% using SEO and Ad campaigns..."`}
                      className="w-full h-32 p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none shadow-inner"
                    />
                  </div>

                  {activeTab?.customFields?.length > 0 && (
                    <div className="flex flex-col gap-4 mt-2">
                      {activeTab.customFields.map((field, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">{field.label}</label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={missionParams[field.name] || ''}
                              onChange={(e) => setMissionParams({ ...missionParams, [field.name]: e.target.value })}
                              className="w-full h-20 p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary resize-none shadow-inner"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={missionParams[field.name] || ''}
                              onChange={(e) => setMissionParams({ ...missionParams, [field.name]: e.target.value })}
                              className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-medium"
                            >
                              <option value="">Select an option</option>
                              {field.options?.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === 'checkbox' ? (
                            <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-colors">
                              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${missionParams[field.name] ? 'bg-brand-primary border-brand-primary' : 'bg-slate-50 border-slate-200'}`}>
                                {missionParams[field.name] && <Check size={14} className="text-white" />}
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={!!missionParams[field.name]}
                                onChange={(e) => setMissionParams({ ...missionParams, [field.name]: e.target.checked })}
                              />
                              <span className="text-sm font-medium text-slate-700">{field.label}</span>
                            </label>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : 'text'}
                              value={missionParams[field.name] || ''}
                              onChange={(e) => setMissionParams({ ...missionParams, [field.name]: field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value })}
                              className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary font-medium"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 mt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Execution Mode</label>
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-sm mt-1">

                      <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${approvePlan ? 'bg-brand-primary border-brand-primary' : 'bg-slate-50 border-slate-200'}`}>
                          {approvePlan && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input
                          type="radio"
                          name="execMode"
                          className="hidden"
                          checked={approvePlan}
                          onChange={() => { setApprovePlan(true); setAutoPilot(false); }}
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${approvePlan ? 'text-slate-900' : 'text-slate-600'}`}>Approve Plan Before Launch</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Review the generated strategy first</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${autoPilot ? 'bg-brand-primary border-brand-primary' : 'bg-slate-50 border-slate-200'}`}>
                          {autoPilot && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <input
                          type="radio"
                          name="execMode"
                          className="hidden"
                          checked={autoPilot}
                          onChange={() => { setAutoPilot(true); setApprovePlan(false); }}
                        />
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${autoPilot ? 'text-slate-900' : 'text-slate-600'}`}>Auto-Pilot Mode</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Immediate deployment after plan generation</span>
                        </div>
                      </label>

                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateMission}
                  disabled={isCreating || !missionInput.trim()}
                  className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isCreating ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      Deploy Mission
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Pane - Mission History or Details */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {selectedMission ? (
              <MissionDetails
                mission={missions.find(m => m.id === selectedMission.id) || selectedMission}
                onClose={() => setSelectedMission(null)}
                onUpdate={(updatedMission) => {
                  setSelectedMission(updatedMission);
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Mission Log</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                  {activeTabMissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <AlertCircle size={24} className="text-slate-300" />
                      </div>
                      <p className="text-sm font-medium">No missions assigned to this commander.</p>
                    </div>
                  ) : (
                    activeTabMissions.map(mission => (
                      <div
                        key={mission.id}
                        onClick={() => setSelectedMission(mission)}
                        className="p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-brand-primary hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-800 group-hover:text-brand-primary transition-colors line-clamp-1 flex-1 pr-4">{mission.title}</h4>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(mission.status)}`}>
                              {mission.status}
                            </span>
                            {mission.status?.toLowerCase() === 'failed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMissionRestart(mission.id); }}
                                className="px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm"
                              >
                                Retry
                              </button>
                            )}
                            {(mission.status?.toLowerCase() === 'completed' || mission.status?.toLowerCase() === 'success') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMissionRestart(mission.id); }}
                                className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm"
                              >
                                Restart
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setMissionToDelete(mission); }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Delete Mission"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium bg-slate-50 px-2 py-1 rounded">Budget: ${mission.budget_cap}</span>
                          <span>{new Date(mission.createdAt?.seconds ? mission.createdAt.seconds * 1000 : mission.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {missionToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Mission?</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete <strong>"{missionToDelete.title}"</strong>? This action cannot be undone.
            </p>

            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors mb-6">
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${deleteTasks ? 'bg-rose-600 border-rose-600' : 'bg-white border-slate-200'}`}>
                {deleteTasks && <Check size={14} className="text-white" />}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={deleteTasks}
                onChange={(e) => setDeleteTasks(e.target.checked)}
              />
              <div className="flex flex-col text-left flex-1">
                <span className="text-sm font-bold text-slate-800">Also Delete all associated Tasks</span>
                <span className="text-[10px] text-slate-400">Cleans up the task board</span>
              </div>
            </label>

            <div className="flex gap-3 justify-end">
              <button
                disabled={isDeleting}
                onClick={() => setMissionToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteMission}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
