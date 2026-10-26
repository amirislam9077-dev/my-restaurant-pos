import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, auth } from '../../api';

// Owner reports ask for email + password every time they are opened (from the POS or the website).
// Moving between report pages keeps this mounted, so it only asks again after leaving Reports or a refresh.
export default function ReportsGate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (unlocked) return children;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, username } = await api.login(email, password);
      auth.save(token, username);
      setUnlocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="topbar"><span className="brand">🍽️ My Restaurant</span></header>
      <main className="container">
        <form className="login-box" onSubmit={submit}>
          <h2>🔐 Owner Reports</h2>
          <p className="muted">Enter your email and password to open the reports.</p>
          <input type="text" placeholder="Email (or username)" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
          <input type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Open Reports'}</button>
          {auth.token() && <Link to="/" className="gate-back">← Back to Orders (POS)</Link>}
        </form>
      </main>
    </>
  );
}
