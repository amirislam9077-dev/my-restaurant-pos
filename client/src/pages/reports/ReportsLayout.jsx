import { useEffect, useState, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { api, auth } from '../../api';

const ymd = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return ymd(d); };

// Quick date ranges for the filter row
export const PRESETS = [
  ['today', 'Today', () => [shift(0), shift(0)]],
  ['yesterday', 'Yesterday', () => [shift(-1), shift(-1)]],
  ['7days', 'Last 7 days', () => [shift(-6), shift(0)]],
  ['month', 'This month', () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), shift(0)]; }],
  ['lastmonth', 'Last month', () => {
    const d = new Date();
    return [ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ymd(new Date(d.getFullYear(), d.getMonth(), 0))];
  }],
];

export const prettyDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Owner reports: left navbar + one date range shared by every report page (kept in the URL)
export default function ReportsLayout() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const from = params.get('from') || shift(0);
  const to = params.get('to') || from;
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  // Sidebar can shrink to an icon strip; remembered per browser, starts narrow on small screens
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('reportsSidebar');
      if (saved) return saved === 'collapsed';
    } catch { /* storage blocked */ }
    return window.innerWidth < 1100;
  });
  const toggleSidebar = () => setCollapsed(c => {
    try { localStorage.setItem('reportsSidebar', c ? 'open' : 'collapsed'); } catch { /* storage blocked */ }
    return !c;
  });

  // reload() keeps the page on screen (used after adding an expense)
  const load = useCallback(() => {
    api.report(from, to).then(r => { setReport(r); setError(''); }).catch(e => setError(e.message));
  }, [from, to]);
  // New date range: show Loading... instead of the previous range's numbers
  useEffect(() => { setReport(null); load(); }, [load]);

  const setRange = (f, t) => setParams({ from: f, to: t }, { replace: true });
  const active = PRESETS.find(([, , fn]) => { const [f, t] = fn(); return f === from && t === to; })?.[0];
  const q = `?from=${from}&to=${to}`;
  const link = (to, icon, label) => (
    <NavLink to={to + q} end className="rep-link" title={label}>
      <span className="rep-icon">{icon}</span><span className="rep-label">{label}</span>
    </NavLink>
  );

  const logout = () => { auth.logout(); navigate('/login'); };

  return (
    <div className={`rep-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="rep-side no-print">
        <div className="rep-brand">
          <button className="rep-toggle" onClick={toggleSidebar} title={collapsed ? 'Menu kholein' : 'Menu chhota karein'}>☰</button>
          <div className="rep-brand-text">
            <b>🍽️ My Restaurant</b>
            <small>Owner Reports</small>
          </div>
        </div>
        <nav className="rep-nav">
          {link('/admin', '📊', 'Dashboard')}
          {link('/admin/orders', '📋', 'Orders')}
          {link('/admin/scale', '⚖️', 'Scale')}
          {link('/admin/sales', '💰', 'Sales')}
          {link('/admin/waiters', '🧑‍🍳', 'Waiters')}
          {link('/admin/expenses', '🧾', 'Expenses')}
          {link('/admin/profit', '📈', 'Profit & Loss')}
          {/* Customer website (online order page), in a new tab so the reports stay open */}
          <a href="/online" target="_blank" rel="noreferrer" className="rep-link rep-site" title="Website">
            <span className="rep-icon">🌐</span><span className="rep-label">Website ↗</span>
          </a>
        </nav>
        <div className="rep-foot">
          {/* New tab, so the reports stay open (and don't ask for the password again) */}
          <a href="/" target="_blank" rel="noreferrer" className="rep-back" title="Orders (POS)">←<span className="rep-label"> Orders (POS) ↗</span></a>
          <div className="rep-user">👤<span className="rep-label"> {auth.user()}</span> <button className="link" onClick={logout} title="Logout">Logout</button></div>
        </div>
      </aside>

      <main className="rep-main">
        <div className="rep-filter no-print">
          <div className="rep-presets">
            {PRESETS.map(([key, label, fn]) => (
              <button key={key} className={active === key ? 'active' : ''} onClick={() => setRange(...fn())}>{label}</button>
            ))}
          </div>
          <div className="rep-custom">
            <input type="date" value={from} max={to} onChange={e => e.target.value && setRange(e.target.value, to)} />
            <span>to</span>
            <input type="date" value={to} min={from} onChange={e => e.target.value && setRange(from, e.target.value)} />
            <button className="btn-outline" onClick={() => window.print()}>🖨️ Print</button>
          </div>
        </div>
        <p className="rep-range">
          📅 {from === to ? prettyDate(from) : `${prettyDate(from)} – ${prettyDate(to)}`}
        </p>
        {error && <p className="error">{error}</p>}
        {!report && !error && <p className="muted">Loading...</p>}
        {/* Empty period (e.g. "Today" before the first sale): say so and offer wider ranges */}
        {report && !report.summary.orders && !report.summary.expenses && (
          <div className="hint rep-empty no-print">
            <span>📭 In tarikhon mein koi sale nahi hui. Pichhli sale dekhne ke liye:</span>
            {PRESETS.filter(([key]) => ['7days', 'month', 'lastmonth'].includes(key)).map(([key, label, fn]) => (
              <button key={key} className="btn-outline" onClick={() => setRange(...fn())}>{label}</button>
            ))}
          </div>
        )}
        {report && <Outlet context={{ report, from, to, reload: load }} />}
      </main>
    </div>
  );
}
