import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../../api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { token, username: name } = await api.login(username, password);
      auth.save(token, name);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="login-box" onSubmit={submit}>
      <h2>🔐 Admin Login</h2>
      <input placeholder="Email or username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit">Login</button>
    </form>
  );
}
