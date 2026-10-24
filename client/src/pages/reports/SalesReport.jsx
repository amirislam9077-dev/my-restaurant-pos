import { useNavigate, useOutletContext } from 'react-router-dom';
import BarChart from '../../components/BarChart';
import { ORDER_TYPES } from '../../orderTypes';
import { COLORS, Kpi, Share, rs, short, pct } from './shared';

const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

export default function SalesReport() {
  const { report, from, to } = useOutletContext();
  const navigate = useNavigate();
  const { summary: s, daily, byType, items, byHour } = report;
  const maxItem = Math.max(0, ...items.map(i => i.revenue));
  const categories = Object.values(items.reduce((acc, i) => {
    acc[i.category] = acc[i.category] || { category: i.category, qty: 0, revenue: 0 };
    acc[i.category].qty += i.qty;
    acc[i.category].revenue += i.revenue;
    return acc;
  }, {})).sort((a, b) => b.revenue - a.revenue);
  const hours = Array.from({ length: 24 }, (_, h) => byHour.find(x => x.hour === h) || { hour: h, orders: 0, sales: 0 })
    .filter(h => h.hour >= Math.min(...byHour.map(x => x.hour), 12) && h.hour <= Math.max(...byHour.map(x => x.hour), 12));

  return (
    <>
      <div className="kpis">
        <Kpi label="💰 Total Sales" value={rs(s.sales)} />
        <Kpi label="🧾 Paid orders" value={s.orders} />
        <Kpi label="🧮 Avg. order" value={rs(s.avgOrder)} />
        <Kpi label="🍔 Items sold" value={items.reduce((t, i) => t + i.qty, 0)} />
      </div>

      <section className="rep-card">
        <h3>Daily Sales</h3>
        <BarChart data={daily.map(d => ({ label: short(d.day), values: [d.sales] }))} series={[{ name: 'Sales', color: COLORS.sales }]} format={rs} />
        <table className="rep-table">
          <thead><tr><th>Date</th><th>Orders</th><th>Sales</th><th>Avg. order</th></tr></thead>
          <tbody>
            {[...daily].reverse().map(d => (
              <tr key={d.day}><td>{short(d.day)}</td><td>{d.orders}</td><td>{rs(d.sales)}</td><td>{d.orders ? rs(d.sales / d.orders) : '-'}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{s.orders}</td><td>{rs(s.sales)}</td><td>{rs(s.avgOrder)}</td></tr></tfoot>
        </table>
      </section>

      <div className="rep-grid two">
        <section className="rep-card">
          <h3>Sales by order type</h3>
          <p className="muted rep-hint">👆 Click a row to see its orders</p>
          <table className="rep-table clickable">
            <thead><tr><th>Type</th><th>Orders</th><th>Sales</th><th>Share</th></tr></thead>
            <tbody>
              {byType.map(t => (
                <tr key={t.type} title="Click for details" onClick={() => navigate(`/reports/orders?from=${from}&to=${to}&type=${t.type}`)}>
                  <td>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</td><td>{t.orders}</td><td>{rs(t.sales)}</td>
                  <td><Share value={t.sales} max={s.sales} /> {pct(t.sales, s.sales)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rep-card">
          <h3>Sales by category</h3>
          <table className="rep-table">
            <thead><tr><th>Category</th><th>Qty</th><th>Sales</th><th>Share</th></tr></thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.category}>
                  <td>{c.category}</td><td>{c.qty}</td><td>{rs(c.revenue)}</td>
                  <td><Share value={c.revenue} max={s.sales} /> {pct(c.revenue, s.sales)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {byHour.length > 0 && (
        <section className="rep-card">
          <h3>Busiest hours (sales by hour)</h3>
          <BarChart data={hours.map(h => ({ label: hourLabel(h.hour), tip: `${hourLabel(h.hour)} · ${h.orders} orders`, values: [h.sales] }))}
            series={[{ name: 'Sales', color: COLORS.sales }]} format={rs} height={180} />
        </section>
      )}

      <section className="rep-card">
        <h3>Sales by item ({items.length})</h3>
        <table className="rep-table">
          <thead><tr><th className="hide-sm">#</th><th>Item</th><th className="hide-sm">Category</th><th>Qty</th><th>Sales</th><th className="hide-sm"></th></tr></thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={i.name}>
                <td className="hide-sm">{n + 1}</td><td>{i.name}</td><td className="muted hide-sm">{i.category}</td><td>{i.qty}</td><td>{rs(i.revenue)}</td>
                <td><Share value={i.revenue} max={maxItem} /></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted">No items sold in this period</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
