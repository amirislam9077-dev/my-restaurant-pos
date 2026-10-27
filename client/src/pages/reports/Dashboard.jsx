import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ORDER_TYPES } from '../../orderTypes';
import { Kpi, ProfitValue, Share, rs, pct } from './shared';

export default function Dashboard() {
  const { report, from, to } = useOutletContext();
  const navigate = useNavigate();
  const { summary: s, daily, byType, items, waiters } = report;
  const q = `?from=${from}&to=${to}`;
  const topWaiters = waiters.filter(w => w.orders).slice(0, 5);

  return (
    <>
      <div className="kpis">
        <Kpi label="💰 Total Sales" value={rs(s.sales)} note={`${s.orders} paid orders`} />
        <Kpi label="🧾 Total Expenses" value={rs(s.expenses)} note={<Link to={`/admin/expenses${q}`}>Add expense →</Link>} />
        <Kpi label="📈 Profit / Loss" value={<ProfitValue value={s.profit} />} tone={s.profit >= 0 ? 'good' : 'bad'}
          note={s.sales ? `${pct(s.profit, s.sales)}% of sales` : ''} />
        <Kpi label="🧮 Avg. order" value={rs(s.avgOrder)} />
        <Kpi label="❌ Cancelled" value={s.cancelledOrders} note={rs(s.cancelledAmount)} />
        <Kpi label="⏳ Open orders" value={s.openOrders} note={`${rs(s.openAmount)} payment pending`} />
      </div>

      <div className="rep-grid">
        <section className="rep-card">
          <h3>Sales by order type</h3>
          <p className="muted rep-hint">👆 Click a row to see its orders</p>
          <table className="rep-table clickable">
            <thead><tr><th>Type</th><th>Orders</th><th>Sales</th><th>Share</th></tr></thead>
            <tbody>
              {byType.map(t => (
                <tr key={t.type} title="Click for details" onClick={() => navigate(`/admin/orders?from=${from}&to=${to}&type=${t.type}`)}>
                  <td>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</td>
                  <td>{t.orders}</td>
                  <td>{rs(t.sales)}</td>
                  <td><Share value={t.sales} max={s.sales} /> {pct(t.sales, s.sales)}%</td>
                </tr>
              ))}
              {!byType.length && <tr><td colSpan={4} className="muted">No sales in this period</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="rep-card">
          <h3>Top 5 items <Link to={`/admin/sales${q}`} className="rep-more">View all →</Link></h3>
          <table className="rep-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Sales</th></tr></thead>
            <tbody>
              {items.slice(0, 5).map(i => (
                <tr key={i.name}><td>{i.name}</td><td>{i.qty}</td><td>{rs(i.revenue)}</td></tr>
              ))}
              {!items.length && <tr><td colSpan={3} className="muted">No items sold</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="rep-card">
          <h3>Top waiters <Link to={`/admin/waiters${q}`} className="rep-more">View all →</Link></h3>
          <table className="rep-table">
            <thead><tr><th>Waiter</th><th>Orders</th><th>Sales</th></tr></thead>
            <tbody>
              {topWaiters.map(w => (
                <tr key={w.id}><td>🧑‍🍳 {w.name}</td><td>{w.orders}</td><td>{rs(w.sales)}</td></tr>
              ))}
              {!topWaiters.length && <tr><td colSpan={3} className="muted">No paid waiter orders</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
