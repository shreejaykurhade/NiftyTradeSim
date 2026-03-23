import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import Portfolio from './pages/Portfolio';
import Login from './pages/Login';
import Register from './pages/Register';

import Landing from './pages/Landing';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-32 text-center text-text-secondary">Loading terminal...</div>;
  if (!user) return <Navigate to="/landing" />;
  return children;
}

function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {user && <Navbar />}
      <main className={user ? "container mx-auto p-4 lg:p-8" : "min-h-screen"}>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          
          <Route path="/" element={
            user ? (
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            ) : (
              <Navigate to="/landing" />
            )
          } />
          
          <Route path="/stock/:symbol" element={
            <ProtectedRoute>
              <StockDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/portfolio" element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
