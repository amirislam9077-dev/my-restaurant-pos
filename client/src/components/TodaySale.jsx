import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ORDER_TYPES, money, orderCode } from '../orderTypes';

const today = () => new Date().toLocaleDateString('en-CA');

// "Today Sale" full-page view on the POS: today's paid sales split by order type, with every order listed
export default function TodaySale({ onClose }) {
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState('all'); // which type's orders are listed below
  const day = today();

  useEffect(() => {
    api.report(day, day).then(setReport).catch(e => setError(e.message));
    api.reportOrders(day, day).then(r => setOrders(r.orders)).catch(e => setError(e.message));
  }, [day]);

  const s = report?.summary;
  const byType = Object.keys(ORDER_TYPES).map(type => ({
    type, ...(report?.byType.find(t => t.type === type) || { orders: 0, sales: 0 }),
  }));
  const list = (orders || []).filter(o => pick === 'all' || o.order_type === pick);
  const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="today-page">
      <div className="today-page-head">
        <h2>💰 Today's Sale <small>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</small></h2>
        <button className="btn-outline" onClick={onClose}>✕ Close</button>
      </div>
      {error && <p className="error">{error}</p>}
      {!report && !error && <p className="muted">Loading...</p>}
      {report && (
        <>
          <div className="ts-stats">
            <div className="ts-stat green"><small>Total sale (paid)</small><b>{money(s.sales)}</b><span>{s.orders} orders · avg. {money(Math.round(s.avgOrder))}</span></div>
            <div className="ts-stat amber"><small>⏳ Unpaid open orders</small><b>{money(s.openAmount)}</b><span>{s.openOrders} orders waiting for payment</span></div>
            <div className="ts-stat red"><small>❌ Cancelled</small><b>{money(s.cancelledAmount)}</b><span>{s.cancelledOrders} orders (not counted in sale)</span></div>
            <div className="ts-stat"><small>🧾 Expenses</small><b>{money(s.expenses)}</b><span>Spent today</span></div>
            <div className="ts-stat blue"><small>Profit (sale − expenses)</small><b>{money(s.profit)}</b><span>Today</span></div>
          </div>

          <h3 className="ts-h">Sale by order type <small className="muted">— click a type to see its orders</small></h3>
          <div className="ts-types">
            <button className={`ts-type ${pick === 'all' ? 'active' : ''}`} onClick={() => setPick('all')}>
              <span>🧾 All types</span><b>{money(s.sales)}</b><small>{s.orders} orders</small>
            </button>
            {byType.map(t => (
              <button key={t.type} className={`ts-type ${pick === t.type ? 'active' : ''}`} onClick={() => setPick(t.type)}>
                <span>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</span>
                <b>{money(t.sales)}</b>
                <small>{t.orders} orders</small>
              </button>
            ))}
          </div>

          <h3 className="ts-h">{pick === 'all' ? '🧾 All paid orders today' : `${ORDER_TYPES[pick].icon} ${ORDER_TYPES[pick].label} orders today`}</h3>
          {!orders && <p className="muted">Loading...</p>}
          {orders && !list.length && <p className="muted ts-empty">No paid orders of this type today.</p>}
          {list.length > 0 && (
            <div className="ts-table-wrap">
              <table className="ts-table">
                <thead>
                  <tr><th>Order</th><th>Time</th><th>Type</th><th>Table / Customer</th><th>Waiter</th><th>Items</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {list.map(o => (
                    <tr key={o.id}>
                      <td><b>{orderCode(o)}</b></td>
                      <td>{time(o.paid_at)}</td>
                      <td>{ORDER_TYPES[o.order_type].icon} {ORDER_TYPES[o.order_type].label}</td>
                      <td>{o.table_id ? `Table ${o.table_id}` : o.customer_name || 'Cash customer'}</td>
                      <td>{o.waiter_name || '—'}</td>
                      <td className="ts-items">{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
                      <td className="num"><b>{money(o.total)}</b></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={6}>Total ({list.length} orders)</td><td className="num">{money(list.reduce((a, o) => a + o.total, 0))}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <Link className="btn-outline ts-more" to={`/admin?from=${day}&to=${day}`} onClick={onClose}>📊 Open full report →</Link>
        </>
      )}
    </div>
  );
}
