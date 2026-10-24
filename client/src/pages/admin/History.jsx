import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { ORDER_TYPES, money, orderCode } from '../../orderTypes';

// Today's closed orders + sales summary
export default function History() {
  const [orders, setOrders] = useState([]);

  useEffect(() => { api.orders(true).then(setOrders); }, []);

  const paid = orders.filter(o => o.status === 'paid');
  const total = paid.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <div className="stats">
        <div className="stat"><small>Today Sales</small><b>{money(total)}</b></div>
        {Object.entries(ORDER_TYPES).map(([k, t]) => (
          <div key={k} className="stat">
            <small>{t.icon} {t.label}</small>
            <b>{money(paid.filter(o => o.order_type === k).reduce((s, o) => s + o.total, 0))}</b>
          </div>
        ))}
      </div>
      <table className="data-table stack history-table">
        <thead>
          <tr><th>Order No</th><th>Time</th><th>Type</th><th>Table / Customer</th><th>Waiter</th><th>Total</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td className="cell-title h-code">{orderCode(o)}</td>
              <td className="h-meta">{new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
              <td className="h-meta">{ORDER_TYPES[o.order_type].icon} {ORDER_TYPES[o.order_type].label}</td>
              <td className="h-meta">{o.table_id ? `Table ${o.table_id}` : o.customer_name || ''}</td>
              <td className="h-meta">{o.waiter_name ? `🧑‍🍳 ${o.waiter_name}` : ''}</td>
              {/* Mobile only: all details on one line */}
              <td className="h-details">
                {[
                  new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                  `${ORDER_TYPES[o.order_type].icon} ${ORDER_TYPES[o.order_type].label}`,
                  o.table_id ? `Table ${o.table_id}` : o.customer_name,
                  o.waiter_name && `🧑‍🍳 ${o.waiter_name}`,
                ].filter(Boolean).join('  ·  ')}
              </td>
              <td className="h-total">{money(o.total)}</td>
              <td className="h-status"><span className={`badge ${o.status}`}>{o.status}</span></td>
              <td className="h-bill"><Link className="btn-outline" to={`/bill/order/${o.id}`}>🖨️ Bill</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <p className="muted">Aaj abhi koi order close nahi hua</p>}
    </>
  );
}
