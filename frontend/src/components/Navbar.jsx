import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';
import nifty50Logo from '../assets/nifty50-logo.svg';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-accent-green/10 text-accent-green'
        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-border-color/80 bg-bg-primary/86 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={nifty50Logo} alt="Nifty50Sim" className="brand-mark" />
            <span>
              <span className="block text-sm font-bold tracking-wide text-text-primary">Nifty50Sim</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>
              Market
            </NavLink>
            <NavLink to="/portfolio" className={navClass}>
              Portfolio
            </NavLink>
            <NavLink to="/strategy-lab" className={navClass}>
              Strategy Lab
            </NavLink>
            <NavLink to="/agent-trading" className={navClass}>
              Agent Trading
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-md border border-border-color bg-bg-secondary px-4 py-2 text-right sm:block">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Buying Power</p>
            <p className="text-sm font-semibold tabular-nums text-accent-green">
              {formatCurrency(user?.balance, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="hidden text-right lg:block">
            <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
            <p className="text-[11px] text-text-muted">Active session</p>
          </div>
          <button onClick={handleLogout} className="btn-ghost px-4 py-2 text-sm">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
