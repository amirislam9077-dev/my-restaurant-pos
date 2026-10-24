import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import BarChart from '../../components/BarChart';
import { COLORS, Kpi, Share, rs, short, pct } from './shared';

// How much work each waiter did (dine-in orders they took that got paid)
export default function WaiterReport() {
  const { report } = useOutletContext();
  const { waiters, daily } = report;
  const [selectedId, setSelectedId] = useState(null);
  const working = waiters.filter(w => w.orders);
  const totalSales = waiters.reduce((t, w) => t + w.sales, 0);
  const maxSales = Math.max(0, ...waiters.map(w => w.sales));
  const selected = waiters.find(w => w.id === selectedId) || working[0];
  const selDaily = selected ? daily.map(d => selected.daily.find(x => x.day === d.day) || { day: d.day, orders: 0, sales: 0 }) : [];

  return (
    <>
      <div className="kpis">
        <Kpi label="🧑‍🍳 Active waiters" value={`${working.length} / ${waiters.length}`} />
        <Kpi label="🍽️ Waiter orders" value={working.reduce((t, w) => t + w.orders, 0)} />
        <Kpi label="💰 Waiter sales" value={rs(totalSales)} />
        <Kpi label="🏆 Top seller" value={working[0]?.name || "-"} note={working[0] ? rs(working[0].sales) : ""} />
      </div>

      <section className="rep-card">
        <h3>Waiter performance</h3>
        <p className="muted rep-hint">Only paid Dine-In orders are counted. Click a waiter to see their daily report.</p>
        <table className="rep-table clickable">
          <thead>
            <tr><th className="hide-sm">#</th><th>Waiter</th><th>Orders</th><th className="hide-sm">Tables</th><th className="hide-sm">Items</th><th>Sales</th><th className="hide-sm">Avg. order</th><th>Share</th></tr>
          </thead>
          <tbody>
            {waiters.map((w, n) => (
              <tr key={w.id} className={selected?.id === w.id ? 'selected' : ''} onClick={() => setSelectedId(w.id)}>
                <td className="hide-sm">{n + 1}</td>
                <td>🧑‍🍳 {w.name}{!w.active && <small className="muted"> (inactive)</small>}</td>
                <td>{w.orders}</td><td className="hide-sm">{w.tablesServed}</td><td className="hide-sm">{w.items}</td><td>{rs(w.sales)}</td>
                <td className="hide-sm">{w.orders ? rs(w.avgOrder) : '-'}</td>
                <td><Share value={w.sales} max={maxSales} /> {pct(w.sales, totalSales)}%</td>
              </tr>
            ))}
            {!waiters.length && <tr><td colSpan={8} className="muted">No waiters yet</td></tr>}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="rep-card">
          <h3>🧑‍🍳 {selected.name} · daily</h3>
          <BarChart data={selDaily.map(d => ({ label: short(d.day), tip: `${short(d.day)} · ${d.orders} orders`, values: [d.sales] }))}
            series={[{ name: `${selected.name} sales`, color: COLORS.sales }]} format={rs} height={180} />
          <table className="rep-table">
            <thead><tr><th>Date</th><th>Orders</th><th>Sales</th></tr></thead>
            <tbody>
              {[...selDaily].reverse().filter(d => d.orders).map(d => (
                <tr key={d.day}><td>{short(d.day)}</td><td>{d.orders}</td><td>{rs(d.sales)}</td></tr>
              ))}
              {!selDaily.some(d => d.orders) && <tr><td colSpan={3} className="muted">No orders in this period</td></tr>}
            </tbody>
            <tfoot><tr><td>Total</td><td>{selected.orders}</td><td>{rs(selected.sales)}</td></tr></tfoot>
          </table>
        </section>
      )}
    </>
  );
}
