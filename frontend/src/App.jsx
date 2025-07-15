import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';
import UploadAttendance from './pages/UploadAttendance';
import NavBar from './components/NavBar';
import { AuthContext } from './components/AuthProvider';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          setUser(res.data.user);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching user:', err);
          localStorage.removeItem('token');
          setLoading(false);
          navigate('/login');
        });
    } else {
      setLoading(false);
      navigate('/login');
    }
  }, [navigate]);

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

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="min-h-screen bg-gray-100 flex flex-col font-amiri">
        {user && <NavBar />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-user" element={<CreateUser />} />
          <Route path="/upload-attendance" element={<UploadAttendance />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </div>
    </AuthContext.Provider>
  );
};

export default App;
