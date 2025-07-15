import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';
import NavBar from './components/NavBar';
import { AuthContext } from './components/AuthProvider';

const App = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    navigate('/dashboard');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="min-h-screen bg-gray-100 flex flex-col font-amiri">
        {user && <NavBar />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-user" element={<CreateUser />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
};

export default App;
