import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import OrderCard from '../../components/OrderCard';
import { api } from '../../api';
import { money, newestOrderId, orderCode } from '../../orderTypes';

const today = () => new Date().toLocaleDateString('en-CA');
const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

export default function OnlineOrders() {
  const { orders, setStatus } = useOutletContext();
  const list = orders.filter(o => o.order_type === 'online');
  const newestId = newestOrderId(list);

  // Today's paid online orders; reloaded whenever an active order leaves the list (e.g. marked paid)
  const [done, setDone] = useState(null);
  const activeKey = list.map(o => o.id).join(',');
  useEffect(() => {
    const day = today();
    api.reportOrders(day, day, 'online').then(r => setDone(r.orders)).catch(() => setDone([]));
  }, [activeKey]);

  const doneTotal = (done || []).reduce((a, o) => a + o.total, 0);
  const pendingTotal = list.reduce((a, o) => a + o.total, 0);

  return (
    <>
      <h3>🌐 Online Orders (Website)</h3>
      <p className="muted">Orders placed by customers on the website's <b>/online</b> page show up here.</p>

      <div className="ts-stats online-stats">
        <div className="ts-stat green"><small>Today's online sale (completed)</small><b>{money(doneTotal)}</b><span>{done ? done.length : '…'} orders paid</span></div>
        <div className="ts-stat amber"><small>⏳ Pending orders</small><b>{money(pendingTotal)}</b><span>{list.length} orders not paid yet</span></div>
        <div className="ts-stat blue"><small>Total today (completed + pending)</small><b>{money(doneTotal + pendingTotal)}</b><span>{(done?.length || 0) + list.length} orders</span></div>
      </div>

      <h3 className="ts-h">⏳ Pending orders · {list.length}</h3>
      {!list.length && <p className="muted ts-empty">No pending online orders right now.</p>}
      <div className="orders">
        {list.map(o => <OrderCard key={o.id} order={o} onStatus={setStatus} isNew={o.id === newestId} />)}
      </div>

      <h3 className="ts-h">✅ Completed today · {done ? done.length : '…'}</h3>
      {!done && <p className="muted">Loading...</p>}
      {done && !done.length && <p className="muted ts-empty">No completed online orders today.</p>}
      {done?.length > 0 && (
        <div className="ts-table-wrap">
          <table className="ts-table">
            <thead>
              <tr><th>Order</th><th>Time</th><th>Type</th><th>Customer</th><th>Phone</th><th>Items</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {done.map(o => (
                <tr key={o.id}>
                  <td><b>{orderCode(o)}</b></td>
                  <td>{time(o.paid_at)}</td>
                  <td>🌐 Online</td>
                  <td>{o.customer_name || 'Customer'}</td>
                  <td>{o.customer_phone || '—'}</td>
                  <td className="ts-items">{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
                  <td className="num"><b>{money(o.total)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={6}>Total ({done.length} orders)</td><td className="num">{money(doneTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
