import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Categories from './pages/Categories';
import Packages from './pages/Packages';
import Agents from './pages/Agents';
import Taskforce from './pages/Taskforce';
import AgentDetails from './pages/AgentDetails';
import Taskboard from './pages/Taskboard';
import GlobalVars from './pages/GlobalVars';
import Settings from './pages/Settings';
import CommandCenter from './pages/CommandCenter';
import CommandCenterConfig from './pages/CommandCenterConfig';

function App() {
 return (
  <AuthProvider>
   <Router>
    <Routes>
     <Route path="/login" element={<Login />} />
     <Route path="/" element={
      <ProtectedRoute>
       <DashboardLayout />
      </ProtectedRoute>
     }>
      <Route index element={<Dashboard />} />
      <Route path="command-center" element={<CommandCenter />} />
      <Route path="taskforce" element={<Taskforce />} />
      <Route path="agent/:id" element={<AgentDetails />} />
      <Route path="taskboard" element={<Taskboard />} />
      <Route path="users" element={<Users />} />
      <Route path="agents" element={<Agents />} />
      <Route path="command-center-config" element={<CommandCenterConfig />} />
      <Route path="categories" element={<Categories />} />
      <Route path="packages" element={<Packages />} />
      <Route path="global-vars" element={<GlobalVars />} />
      <Route path="settings" element={<Settings />} />
      <Route path="help" element={<Dashboard />} />
     </Route>
     {/* Catch all redirect to dashboard */}
     <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
   </Router>
  </AuthProvider>
 );
}

export default App;
