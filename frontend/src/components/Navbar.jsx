import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass sticky top-0 z-50 border-b border-border-color">
      <div className="container mx-auto px-4 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-accent-green hover:opacity-80 transition-opacity">
            Nifty50Sim
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/" className="text-text-primary hover:text-accent-green transition-colors">Market</Link>
            <Link to="/portfolio" className="text-text-primary hover:text-accent-green transition-colors">Portfolio</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-text-secondary">Balance</p>
            <p className="text-sm font-bold text-accent-green">
              ₹ {(user?.balance || 0).toLocaleString('en-IN')}
            </p>
          </div>
          
          <div className="h-8 w-[1px] bg-border-color hidden sm:block"></div>

          <div className="flex items-center gap-3">
            <span className="hidden lg:inline text-sm text-text-secondary">Hi, {user.name}</span>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 rounded text-sm font-medium bg-bg-secondary hover:bg-border-color transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
