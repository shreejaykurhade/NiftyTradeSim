import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/landing" className="mb-6 flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-accent-green text-sm font-black text-bg-primary">N50</span>
          <span className="text-lg font-black">Nifty50Sim</span>
        </Link>
        <section className="surface p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Create workspace</h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Start with simulated capital and trade the NIFTY 50 without real-market risk.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}

            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Full name</label>
              <input type="text" required placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Email address</label>
              <input type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-text-secondary">Password</label>
              <input type="password" required placeholder="Create a password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>

            <button type="submit" className="btn-primary w-full">Create account</button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already registered? <Link to="/login" className="font-semibold text-accent-green hover:text-text-primary">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
