import { Link } from 'react-router-dom';
import { ORDER_TYPES, statusText, nextActions, money, orderCode } from '../orderTypes';

// isNew: set by the list for its single latest order (see newestOrderId)
export default function OrderCard({ order, onStatus, onReorder, isNew }) {
  const type = ORDER_TYPES[order.order_type];
  return (
    <div className={`order-card ${order.status} ${isNew ? 'is-new' : ''}`}>
      {isNew && <span className="new-ribbon">🆕 NEW</span>}
      <div className="line">
        <b>
          {/* Dine-in cards sit under their table's header, so only the order number is needed */}
          {type.icon} {order.order_type === 'dine_in' ? `Order ${orderCode(order)}` : `${type.label} · ${orderCode(order)}`}
        </b>
        <span className={`badge ${order.status}`}>{statusText(order)}</span>
      </div>
      <small className="muted">
        {new Date(order.created_at).toLocaleTimeString()}
        {/* Numbers restart daily, so flag older orders with their date */}
        {new Date(order.created_at).toDateString() !== new Date().toDateString() && (
          <span className="old-day"> · 📅 {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        )}
        {order.waiter_name && <> · 🧑‍🍳 {order.waiter_name}</>}
      </small>
      {order.customer_name && (
        <div className="customer">
          👤 {order.customer_name} {order.customer_phone && <>· 📱 {order.customer_phone}</>}
          {order.address && <div>📍 {order.address}</div>}
        </div>
      )}
      <ul>
        {order.items.map((i, idx) => <li key={idx}>{i.name} × {i.qty} <span>{money(i.price * i.qty)}</span></li>)}
      </ul>
      {order.note && <p className="note">📝 {order.note}</p>}
      <div className="line total"><span>Total</span><span>{money(order.total)}</span></div>
      <div className="actions">
        {nextActions(order).map(([s, label]) => (
          <button key={s} className={s === 'cancelled' ? 'danger' : 'primary'} onClick={() => onStatus(order.id, s)}>{label}</button>
        ))}
        <Link className="btn-outline" to={`/bill/order/${order.id}?print=both`}>🖨️ Print</Link>
      </div>
      {onReorder && (
        <button className="reorder-btn" onClick={() => onReorder(order)}>🔁 Reorder</button>
      )}
    </div>
  );
}
