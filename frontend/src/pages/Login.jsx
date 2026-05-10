import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to your NIFTY 50 trading workspace.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-secondary">Email address</label>
          <input type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-text-secondary">Password</label>
          <input type="password" required placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        New to Nifty50Sim? <Link to="/register" className="font-semibold text-accent-green hover:text-text-primary">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/landing" className="mb-6 flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-green text-sm font-black text-bg-primary">N50</span>
          <span className="text-lg font-black">Nifty50Sim</span>
        </Link>
        <section className="surface p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{subtitle}</p>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
