import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';

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
            <span className="grid h-9 w-9 place-items-center rounded-md bg-accent-green text-sm font-black text-bg-primary">
              N50
            </span>
            <span>
              <span className="block text-sm font-black tracking-wide text-text-primary">Nifty50Sim</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                Paper Trading
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={navClass}>
              Market
            </NavLink>
            <NavLink to="/portfolio" className={navClass}>
              Portfolio
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
