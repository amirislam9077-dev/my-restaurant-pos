import { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { WEEKDAYS, hourRange, trendSummary } from '../../components/TrendCharts';
import { ORDER_TYPES, orderCode } from '../../orderTypes';
import { Kpi, Share, rs, short, pct } from './shared';

const TYPES = [['', 'All'], ...Object.entries(ORDER_TYPES).map(([k, t]) => [k, `${t.icon} ${t.label}`])];
const time = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Detail of one order type (Dine-In, Takeaway...): KPIs, daily chart, top items, every paid order
export default function OrdersReport() {
  const { report, from, to } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [trends, setTrends] = useState(null);
  // Orders not paid yet (e.g. a new website order) - sales figures above only count paid orders
  const [pending, setPending] = useState([]);

  useEffect(() => {
    setData(null);
    setTrends(null);
    api.reportOrders(from, to, type).then(setData).catch(e => setError(e.message));
    api.trends(from, to, 'all', type).then(setTrends).catch(e => setError(e.message));
    api.orders().then(list => setPending(list.filter(o => !type || o.order_type === type))).catch(() => setPending([]));
  }, [from, to, type]);

  const pickType = (t) => {
    const next = new URLSearchParams(params);
    if (t) next.set('type', t); else next.delete('type');
    setParams(next, { replace: true });
    setOpen(null);
  };

  const orders = data?.orders || [];
  const sales = orders.reduce((s, o) => s + o.total, 0);
  const itemsSold = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const daily = report.daily.map(d => {
    const list = orders.filter(o => o.day === d.day);
    return { day: d.day, orders: list.length, sales: list.reduce((s, o) => s + o.total, 0) };
  });
  const items = Object.values(orders.flatMap(o => o.items).reduce((acc, i) => {
    acc[i.name] = acc[i.name] || { name: i.name, qty: 0, revenue: 0 };
    acc[i.name].qty += i.qty;
    acc[i.name].revenue += i.qty * i.price;
    return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue);
  // Waiters are only picked for dine-in orders
  const showWaiter = !type || type === 'dine_in';
  const cols = 6 + (type ? 0 : 1) + (showWaiter ? 1 : 0);
  const label = type ? `${ORDER_TYPES[type].icon} ${ORDER_TYPES[type].label}` : 'All orders';

  return (
    <>
      <div className="type-tabs no-print">
        {TYPES.map(([k, l]) => (
          <button key={k} className={type === k ? 'active' : ''} onClick={() => pickType(k)}>{l}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading...</p>}
      {data && (
        <>
          <div className="kpis">
            <Kpi label={`💰 ${label} sales`} value={rs(sales)} note={`${pct(sales, report.summary.sales)}% of total sales`} />
            <Kpi label="🧾 Paid orders" value={orders.length} />
            <Kpi label="🧮 Avg. order" value={rs(orders.length ? sales / orders.length : 0)} />
            <Kpi label="🍔 Items sold" value={itemsSold} />
            {trends && (() => {
              const t = trendSummary(trends);
              return (
                <>
                  <Kpi label="⏰ Peak hour" value={t.peaks[0] ? hourRange(t.peaks[0].hour) : '-'} note={t.peaks[0] ? rs(t.peaks[0].sales) : ''} />
                  <Kpi label="📆 Peak day" value={t.bestDays[0] ? WEEKDAYS[t.bestDays[0].dow - 1] : '-'} note={t.bestDays[0] ? rs(t.bestDays[0].sales) : ''} />
                </>
              );
            })()}
          </div>


          <div className="rep-grid two">
            <section className="rep-card">
              <h3>Top items</h3>
              <table className="rep-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Sales</th><th>Share</th></tr></thead>
                <tbody>
                  {items.slice(0, 10).map(i => (
                    <tr key={i.name}><td>{i.name}</td><td>{i.qty}</td><td>{rs(i.revenue)}</td>
                      <td><Share value={i.revenue} max={sales} /> {pct(i.revenue, sales)}%</td></tr>
                  ))}
                  {!items.length && <tr><td colSpan={4} className="muted">No items sold</td></tr>}
                </tbody>
              </table>
            </section>
            <section className="rep-card">
              <h3>Daily summary</h3>
              <table className="rep-table">
                <thead><tr><th>Date</th><th>Orders</th><th>Sales</th><th>Avg. order</th></tr></thead>
                <tbody>
                  {[...daily].reverse().filter(d => d.orders).map(d => (
                    <tr key={d.day}><td>{short(d.day)}</td><td>{d.orders}</td><td>{rs(d.sales)}</td><td>{rs(d.sales / d.orders)}</td></tr>
                  ))}
                  {!orders.length && <tr><td colSpan={4} className="muted">No orders in this period</td></tr>}
                </tbody>
                {orders.length > 0 && <tfoot><tr><td>Total</td><td>{orders.length}</td><td>{rs(sales)}</td><td>{rs(sales / orders.length)}</td></tr></tfoot>}
              </table>
            </section>
          </div>

          {pending.length > 0 && (
            <section className="rep-card pending-card">
              <h3>⏳ Pending orders ({pending.length}) · payment baaki</h3>
              <p className="muted rep-hint">Abhi sale mein nahi gine gaye. Paid hone ke baad upar aur neeche ki list mein aa jayenge.</p>
              <table className="rep-table">
                <thead><tr><th>Order</th><th className="hide-sm">Time</th><th>Customer</th><th className="hide-sm">Items</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {pending.map(o => (
                    <tr key={o.id}>
                      <td><b>{orderCode(o)}</b></td>
                      <td className="hide-sm">{new Date(o.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                      <td>{o.table_id ? `Table ${o.table_id}` : o.customer_name || '-'}{o.customer_phone && <small className="muted"> · {o.customer_phone}</small>}</td>
                      <td className="hide-sm">{o.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
                      <td>{rs(o.total)}</td>
                      <td><span className={`badge ${o.status}`}>{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="rep-card">
            <h3>Every order ({orders.length})</h3>
            <p className="muted rep-hint">Click an order to see its items.</p>
            <table className="rep-table clickable">
              <thead>
                <tr><th>Order</th><th className="hide-sm">Date</th><th>Paid at</th>{!type && <th className="hide-sm">Type</th>}<th>Table / Customer</th>{showWaiter && <th className="hide-sm">Waiter</th>}<th className="hide-sm">Items</th><th>Total</th></tr>
              </thead>
              <tbody>
                {orders.map(o => [
                  <tr key={o.id} className={open === o.id ? 'selected' : ''} onClick={() => setOpen(open === o.id ? null : o.id)}>
                    <td><b>{orderCode(o)}</b></td>
                    <td className="hide-sm">{short(o.day)}</td>
                    <td>{time(o.paid_at)}</td>
                    {!type && <td className="hide-sm">{ORDER_TYPES[o.order_type].icon} {ORDER_TYPES[o.order_type].label}</td>}
                    <td>{o.table_id ? `Table ${o.table_id}` : o.customer_name || '-'}</td>
                    {showWaiter && <td className="hide-sm">{o.waiter_name || '-'}</td>}
                    <td className="hide-sm">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td>{rs(o.total)}</td>
                  </tr>,
                  open === o.id && (
                    <tr key={`${o.id}-items`} className="order-items-row">
                      <td colSpan={cols}>
                        {o.items.map(i => (
                          <span key={i.name} className="order-item-chip">{i.name} × {i.qty} · {rs(i.qty * i.price)}</span>
                        ))}
                        {o.customer_phone && <span className="order-item-chip">📱 {o.customer_phone}</span>}
                        {o.paid_amount != null && <span className="order-item-chip">Cash {rs(o.paid_amount)} · Change {rs(o.paid_amount - o.total)}</span>}
                      </td>
                    </tr>
                  ),
                ])}
                {!orders.length && <tr><td colSpan={cols} className="muted">No paid orders in this period</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
