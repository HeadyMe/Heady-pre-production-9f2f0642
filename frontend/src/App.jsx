import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { fetchAPI } from '../utils/drupal-api';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import SacredGeometryBackground from './components/SacredGeometryBackground';
import HeadyWatermark from './components/HeadyWatermark';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Login from './pages/Login';

function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load menu items from Drupal/Backend API
    fetchAPI('/menu/main')
      .then(data => {
        setMenuItems(data.items || []);
      })
      .catch(error => {
        console.error('Failed to load menu items:', error);
        // Set fallback menu items
        setMenuItems([
          { title: 'Home', path: '/' },
          { title: 'Dashboard', path: '/dashboard' },
          { title: 'Admin', path: '/admin' }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <GlobalErrorBoundary>
      <Router>
        <div className="app-container">
          <SacredGeometryBackground />
          
          <Header menuItems={menuItems} loading={loading} />
          
          <main className="main-content">
            <Suspense fallback={
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Loading...</p>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Login />} />
              </Routes>
            </Suspense>
          </main>
          
          <Footer />
          <HeadyWatermark />
        </div>
      </Router>
    </GlobalErrorBoundary>
  );
}

export default App;