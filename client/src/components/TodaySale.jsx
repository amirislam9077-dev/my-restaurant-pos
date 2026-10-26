import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ORDER_TYPES, money, orderCode } from '../orderTypes';

const today = () => new Date().toLocaleDateString('en-CA');

// "Today Sale" box on the POS: today's paid sales split by order type
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

  const list = (orders || []).filter(o => pick === 'all' || o.order_type === pick);
  const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

  const s = report?.summary;
  const byType = Object.keys(ORDER_TYPES).map(type => ({
    type, ...(report?.byType.find(t => t.type === type) || { orders: 0, sales: 0 }),
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal today-sale" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <b>💰 Today Sale · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        {error && <p className="error">{error}</p>}
        {!report && !error && <p className="muted">Loading...</p>}
        {report && (
          <>
            <div className="ts-total">
              <small>Aaj ki kul sale</small>
              <b>{money(s.sales)}</b>
              <span>{s.orders} paid orders · avg. {money(Math.round(s.avgOrder))}</span>
            </div>
            <div className="ts-types">
              {byType.map(t => (
                <button key={t.type} className={`ts-type ${pick === t.type ? 'active' : ''}`} onClick={() => setPick(p => (p === t.type ? 'all' : t.type))}>
                  <span>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</span>
                  <b>{money(t.sales)}</b>
                  <small>{t.orders} orders · detail ▾</small>
                </button>
              ))}
            </div>
            <div className="ts-detail">
              <div className="ts-detail-head">
                <b>{pick === 'all' ? '🧾 Aaj ke sab paid orders' : `${ORDER_TYPES[pick].icon} ${ORDER_TYPES[pick].label} orders`}</b>
                {pick !== 'all' && <button className="link" onClick={() => setPick('all')}>Sab dikhayein</button>}
              </div>
              {!orders && <p className="muted">Loading...</p>}
              {orders && !list.length && <p className="muted">Is type ka aaj koi paid order nahi.</p>}
              {list.map(o => (
                <div key={o.id} className="ts-order">
                  <div className="ts-order-top">
                    <b>{orderCode(o)}</b>
                    <span className="muted">{time(o.paid_at)}</span>
                    <span className="ts-who">{o.table_id ? `Table ${o.table_id}` : o.customer_name || 'Cash customer'}{o.waiter_name ? ` · ${o.waiter_name}` : ''}</span>
                    <b className="ts-amt">{money(o.total)}</b>
                  </div>
                  <small className="muted">{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</small>
                </div>
              ))}
              {list.length > 0 && (
                <div className="line total"><span>Total ({list.length} orders)</span><span>{money(list.reduce((a, o) => a + o.total, 0))}</span></div>
              )}
            </div>
            <div className="line"><span>⏳ Abhi khule orders (payment baaki)</span><b>{s.openOrders} · {money(s.openAmount)}</b></div>
            <div className="line"><span>❌ Cancelled</span><span>{s.cancelledOrders} · {money(s.cancelledAmount)}</span></div>
            <div className="line"><span>🧾 Aaj ke kharche</span><span>{money(s.expenses)}</span></div>
            <div className="line total"><span>Profit (sale − kharche)</span><span>{money(s.profit)}</span></div>
            <Link className="btn-outline ts-more" to={`/reports?from=${day}&to=${day}`} onClick={onClose}>📊 Poori report dekhein →</Link>
          </>
        )}
      </div>
    </div>
  );
}
