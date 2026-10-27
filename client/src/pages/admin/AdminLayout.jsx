import { useEffect, useState, useCallback } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, auth } from '../../api';
import PaymentModal from '../../components/PaymentModal';
import TodaySale from '../../components/TodaySale';
import { orderCode } from '../../orderTypes';

// Setup pages, opened from the header's Manage menu
const MANAGE = [
  ['/menu', '📋 Menu'],
  ['/waiters', '🧑‍🍳 Waiters'],
  ['/qr', '🔳 QR Codes'],
  ['/history', '🧾 Today'],
  ['/account', '👤 Account'],
];

// Loads tables + active orders every 5s and shares them with all admin pages
export default function AdminLayout() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [t, o] = await Promise.all([api.tables(), api.orders()]);
      setTables(t);
      setOrders(o);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [reload]);

  // Marking paid always goes through the payment box (cash received + change)
  const [payFor, setPayFor] = useState(null);

  const setStatus = async (id, status) => {
    if (status === 'paid') {
      const order = orders.find(o => o.id === id);
      // Dine-in: the customer pays the whole table at once (first order + all reorders)
      if (order?.order_type === 'dine_in' && order.table_id) return payTable(order.table_id);
      if (order) return setPayFor({ kind: 'order', order });
    }
    await api.setStatus(id, status);
    reload();
  };

  const payTable = (tableId) => {
    const list = orders
      .filter(o => o.table_id === tableId && (o.status === 'accepted' || o.status === 'served'))
      .sort((a, b) => a.id - b.id);
    if (!list.length) return;
    setPayFor({ kind: 'table', tableId, list, total: list.reduce((s, o) => s + o.total, 0) });
  };

  const printBill = (path) => { setPayFor(null); navigate(path); };

  const payModal = payFor && (payFor.kind === 'order' ? (
    <PaymentModal
      title={`Order ${orderCode(payFor.order)}`}
      subtitle={payFor.order.items.map(i => `${i.name} × ${i.qty}`).join(', ')}
      total={payFor.order.total}
      onConfirm={async (amount) => { await api.setStatus(payFor.order.id, 'paid', amount); reload(); }}
      onClose={() => setPayFor(null)}
      renderDone={() => (
        <button className="primary" onClick={() => printBill(`/bill/order/${payFor.order.id}?print=bill&auto=1`)}>🧾 Print Customer Bill</button>
      )}
    />
  ) : (
    <PaymentModal
      title={`Table ${payFor.tableId}`}
      subtitle={`${payFor.list.length} order${payFor.list.length > 1 ? 's' : ''}: ${payFor.list.map(orderCode).join(', ')}`}
      breakdown={payFor.list.map((o, i) => [
        i === 0 ? `Order ${orderCode(o)} (pehla order)` : `Reorder ${orderCode(o)}`,
        o.total,
      ])}
      total={payFor.total}
      onConfirm={async (amount) => { await api.closeTable(payFor.tableId, amount); reload(); }}
      onClose={() => setPayFor(null)}
      renderDone={() => (
        <button className="primary" onClick={() => printBill(`/bill/orders/${payFor.list.map(o => o.id).join(',')}?print=bill&auto=1`)}>🧾 Print Table Bill</button>
      )}
    />
  ));

  const count = (type) => orders.filter(o => o.order_type === type).length;
  const newCount = (type) => orders.filter(o => o.order_type === type && o.status === 'pending').length;
  const tab = (to, label, type) => (
    <NavLink to={to} end className="tab">
      {label}
      {type && count(type) > 0 && <span className={`count ${newCount(type) ? 'new' : ''}`}>{count(type)}</span>}
    </NavLink>
  );

  const logout = () => {
    auth.logout();
    navigate('/login');
  };

  const { pathname } = useLocation();
  const [manageOpen, setManageOpen] = useState(false);
  const [todayOpen, setTodayOpen] = useState(false);

  // Admin is the site's home page (localhost:5173/)
  return (
    <>
      <header className="topbar no-print">
        <Link to="/" className="brand">🍽️ My Restaurant</Link>
        <nav className="admin-user">
          {/* Setup pages live in a header menu so the tabs below are only for taking orders */}
          <div className={`manage-menu ${manageOpen ? 'open' : ''}`}>
            <button className={`manage-btn ${MANAGE.some(([to]) => to === pathname) ? 'active' : ''}`} onClick={() => setManageOpen(o => !o)}>
              ⚙️<span className="hdr-label"> Manage</span> ▾
            </button>
            {manageOpen && (
              <>
                <div className="manage-backdrop" onClick={() => setManageOpen(false)} />
                <div className="manage-list">
                  {MANAGE.map(([to, label]) => (
                    <NavLink key={to} to={to} end onClick={() => setManageOpen(false)}>{label}</NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
          <Link to="/admin" className="reports-link">📊<span className="hdr-label"> Reports</span></Link>
          <span className="hdr-user">👤<span className="hdr-label"> {auth.user()}</span></span>
          <button className="link" onClick={logout}>Logout</button>
        </nav>
      </header>
      <main className="container">
        <div className="admin-head no-print">
          <nav className="tabs">
            {tab('/', '🍽️ Dine-In', 'dine_in')}
            {tab('/takeaway', '🥡 Takeaway', 'takeaway')}
            {tab('/phone', '📞 Phone', 'phone')}
            {tab('/online-orders', '🌐 Online', 'online')}
          </nav>
          <button className="today-sale-btn" onClick={() => setTodayOpen(true)}>💰 Today Sale</button>
          {/* On a Manage page, show which one and an easy way back to orders */}
          {MANAGE.some(([to]) => to === pathname) && (
            <div className="manage-crumb">
              <b>{MANAGE.find(([to]) => to === pathname)[1]}</b>
            </div>
          )}
        </div>
        {error && <p className="error no-print">{error}</p>}
        <Outlet context={{ tables, orders, reload, setStatus, payTable }} />
        {payModal}
        {todayOpen && <TodaySale onClose={() => setTodayOpen(false)} />}
      </main>
    </>
  );
}
