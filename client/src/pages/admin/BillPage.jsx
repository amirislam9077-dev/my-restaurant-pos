import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { ORDER_TYPES, money, orderCode } from '../../orderTypes';

const RESTAURANT = { name: 'My Restaurant', address: 'Main Road, City', phone: '0300-0000000' };

const MODES = [
  ['both', '🖨️ Both'],
  ['kot', '🍳 Kitchen'],
  ['bill', '🧾 Customer'],
];

// Merge same items across orders
function mergeLines(orders) {
  const lines = {};
  orders.forEach(o => o.items.forEach(i => {
    const key = `${i.name}|${i.price}`;
    lines[key] = lines[key] || { name: i.name, price: i.price, qty: 0 };
    lines[key].qty += i.qty;
  }));
  return Object.values(lines);
}

function orderLabel(order) {
  const type = ORDER_TYPES[order.order_type];
  return order.table_id ? `${type.label} · Table ${order.table_id}` : type.label;
}

// Kitchen Order Ticket: items + qty + note, no prices
function KitchenSlip({ order, lines, isExtra }) {
  return (
    <div className="receipt slip kot">
      <h2>KITCHEN ORDER</h2>
      {isExtra && <div className="kot-extra">➕ EXTRA ORDER</div>}
      <div className="kot-big">{orderCode(order)} · {orderLabel(order)}</div>
      {order.customer_name && <div>{order.customer_name}</div>}
      {order.waiter_name && <div className="kot-waiter">Waiter: {order.waiter_name}</div>}
      <div>{new Date(order.created_at).toLocaleString()}</div>
      <hr />
      <table>
        <tbody>
          {lines.map(l => (
            <tr key={l.name + l.price}><td className="kot-qty">{l.qty} ×</td><td>{l.name}</td></tr>
          ))}
        </tbody>
      </table>
      {order.note && <><hr /><div className="kot-note">📝 {order.note}</div></>}
      <hr />
    </div>
  );
}

function CustomerSlip({ title, order, lines, received }) {
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    <div className="receipt slip">
      <h2>{RESTAURANT.name}</h2>
      <p>{RESTAURANT.address}<br />📞 {RESTAURANT.phone}</p>
      <hr />
      {/* Big order number so the customer can be called at the counter */}
      <div className="bill-order-no">{title.toUpperCase()}</div>
      <div className="line"><span>Date</span><span>{new Date().toLocaleString()}</span></div>
      <div className="line"><span>Type</span><span>{orderLabel(order)}</span></div>
      {order.waiter_name && <div className="line"><span>Waiter</span><span>{order.waiter_name}</span></div>}
      {order.customer_name && <div className="line"><span>Customer</span><span>{order.customer_name} {order.customer_phone}</span></div>}
      {order.address && <div className="line"><span>Address</span><span>{order.address}</span></div>}
      <hr />
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.name + l.price}><td>{l.name}</td><td>{l.qty}</td><td>{l.price}</td><td>{l.qty * l.price}</td></tr>
          ))}
        </tbody>
      </table>
      <hr />
      <div className="line grand"><span>TOTAL</span><span>{money(total)}</span></div>
      {received != null && (
        <>
          <div className="line"><span>Cash Received</span><span>{money(received)}</span></div>
          <div className="line"><span>Change</span><span>{money(received - total)}</span></div>
          <div className="paid-stamp">PAID</div>
        </>
      )}
      <hr />
      <p>Shukriya! Phir tashreef laiye 🙏</p>
    </div>
  );
}

// kind = "order" (single order), "table" (all active orders of a table combined)
//   or "orders" (comma separated ids, e.g. a table that was just closed and paid)
// ?print=both|kot|bill picks the slips, &auto=1 opens the print dialog right away
export default function BillPage() {
  const { kind, id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [isExtra, setIsExtra] = useState(false);
  const [error, setError] = useState('');

  const isTable = kind === 'table' || kind === 'orders';
  const mode = isTable ? 'bill' : params.get('print') || 'bill';

  useEffect(() => {
    const load = kind === 'orders'
      ? Promise.all(id.split(',').map(x => api.order(x)))
      : kind === 'table'
      ? api.tableOrders(id).then(list => list.filter(o => o.status !== 'pending'))
      : api.order(id).then(async o => {
        // Dine-in order added to a table that already has an earlier running order
        if (o.order_type === 'dine_in' && o.table_id) {
          const running = await api.tableOrders(o.table_id);
          setIsExtra(running.some(r => r.id < o.id));
        }
        return [o];
      });
    load.then(setOrders).catch(e => setError(e.message));
  }, [kind, id]);

  useEffect(() => {
    if (!orders?.length || params.get('auto') !== '1') return;
    setParams({ print: mode }, { replace: true });
    setTimeout(() => window.print(), 300);
  }, [orders]);

  if (error) return <p className="error">{error}</p>;
  if (!orders) return <p>Loading...</p>;
  if (!orders.length) return <p className="muted">Is table pe koi accepted order nahi</p>;

  const lines = mergeLines(orders);
  const first = orders[0];
  // Cash received is printed only when every order on the bill has it recorded
  const received = orders.every(o => o.paid_amount != null) ? orders.reduce((s, o) => s + o.paid_amount, 0) : null;
  const billTitle = kind === 'order' ? `Order ${orderCode(first)}` : `Table ${first.table_id ?? id}`;

  return (
    <>
      <div className="no-print bill-toolbar">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        {!isTable && (
          <div className="seg">
            {MODES.map(([m, label]) => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setParams({ print: m }, { replace: true })}>{label}</button>
            ))}
          </div>
        )}
        <button className="primary auto" onClick={() => window.print()}>
          🖨️ Print {mode === 'both' ? '(2 slips)' : ''}
        </button>
      </div>
      <div className="slips">
        {(mode === 'kot' || mode === 'both') && <KitchenSlip order={first} lines={lines} isExtra={isExtra} />}
        {(mode === 'bill' || mode === 'both') && (
          <CustomerSlip title={billTitle} order={first} lines={lines} received={received} />
        )}
      </div>
    </>
  );
}
