import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="card w-full max-w-md space-y-8 glass p-8 rounded-xl border border-border-color shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-accent-green mb-2">Nifty50Sim</h2>
          <p className="text-text-secondary">Premium NIFTY 50 Paper Trading</p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-accent-red bg-accent-red/10 p-3 rounded text-sm text-center">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              required
              className="w-full p-3 rounded"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full p-3 rounded"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="primary w-full py-3 rounded-lg text-lg font-bold">
            Sign In
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent-green hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
