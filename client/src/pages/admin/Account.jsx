import { useEffect, useState } from 'react';
import { api } from '../../api';

// Login email + password for the admin (used for the POS login and to open Reports)
export default function Account() {
  const [me, setMe] = useState(null);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then(m => { setMe(m); setEmail(m.email || ''); }).catch(e => setError(e.message));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (newPassword && newPassword !== confirm) return setError('New passwords do not match');
    try {
      await api.updateAccount({ currentPassword, email, newPassword: newPassword || undefined });
      setMsg(newPassword ? '✅ Email and password saved' : '✅ Email saved');
      setCurrentPassword(''); setNewPassword(''); setConfirm('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="panel account-box" onSubmit={save}>
      <h3>👤 Account (login)</h3>
      <p className="muted">Log in with this email (or the username <b>{me?.username || '...'}</b>) and password. Reports ask for it every time.</p>
      <label>Email</label>
      <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      <label>New password <small className="muted">(leave empty to keep the current one)</small></label>
      <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      {newPassword && (
        <>
          <label>Confirm new password</label>
          <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </>
      )}
      <label>Current password <small className="muted">(required to save)</small></label>
      <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      {msg && <p className="ok-msg">{msg}</p>}
      <button className="primary" type="submit">Save</button>
    </form>
  );
}
