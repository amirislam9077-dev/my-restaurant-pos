import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import OrderCard from '../../components/OrderCard';
import OrderComposer from '../../components/OrderComposer';
import { money, newestOrderId } from '../../orderTypes';

export default function DineIn() {
  const { tables, orders, reload, setStatus, payTable } = useOutletContext();
  const [selected, setSelected] = useState(null);
  const [reorderFrom, setReorderFrom] = useState(null);

  // Manual table pick: fresh cart, forget any pending reorder
  const pickTable = (id) => {
    setReorderFrom(null);
    setSelected(id);
  };

  const reorder = (order) => {
    setSelected(order.table_id);
    setReorderFrom({ ...order }); // new object so the composer refills even for the same order
  };

  const dineIn = orders.filter(o => o.order_type === 'dine_in');
  const newestId = newestOrderId(dineIn);
  const shown = selected ? dineIn.filter(o => o.table_id === selected) : dineIn;

  // Group by table number (1, 2, 3...), oldest order first inside each table
  const groups = [...new Set(shown.map(o => o.table_id))]
    .sort((a, b) => a - b)
    .map(id => {
      const list = shown.filter(o => o.table_id === id).sort((a, b) => a.id - b.id);
      const active = list.filter(o => o.status !== 'cancelled');
      return {
        id,
        list,
        total: active.reduce((s, o) => s + o.total, 0),
        waiters: [...new Set(list.map(o => o.waiter_name).filter(Boolean))],
        canClose: list.some(o => o.status === 'accepted' || o.status === 'served'),
      };
    });

  return (
    <>
      <div className="table-grid small">
        {tables.map(t => (
          <button
            key={t.id}
            onClick={() => pickTable(selected === t.id ? null : t.id)}
            className={`table-card ${t.pending_orders ? 'pending' : t.active_orders ? 'busy' : 'free'} ${selected === t.id ? 'selected' : ''}`}
          >
            <div className="table-num">{t.id}</div>
            <small>{t.pending_orders ? `${t.pending_orders} new` : t.active_orders ? money(t.running_total) : 'Free'}</small>
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <div className="section-head">
            <h3>🍽️ Table {selected} · New Order</h3>
            <button className="link" onClick={() => pickTable(null)}>✕ Close</button>
          </div>
          <OrderComposer type="dine_in" tableId={selected} defaultWaiterId={shown.find(o => o.waiter_id)?.waiter_id} reorderFrom={reorderFrom} onSaved={reload} />
        </>
      ) : (
        <p className="hint">👆 Table select karein, uska menu khulega aur order add kar sakte hain</p>
      )}

      <h3>{selected ? `Table ${selected} Orders` : 'All Dine-In Orders'} ({shown.length})</h3>
      {!shown.length && <p className="muted">Koi active order nahi</p>}
      <div className="table-groups">
      {groups.map(g => (
        <section key={g.id} className="table-group">
          <div className="table-group-head">
            <button className="table-badge" onClick={() => pickTable(g.id)} title="Is table ka menu kholein">{g.id}</button>
            <div className="table-group-info">
              <b>Table {g.id}</b>
              <small>
                {g.list.length} order{g.list.length > 1 ? 's' : ''}
                {g.waiters.length > 0 && <> · 🧑‍🍳 {g.waiters.join(', ')}</>}
              </small>
            </div>
            <div className="table-group-total">{money(g.total)}</div>
            <div className="table-group-actions">
              <Link className="btn-outline" to={`/bill/table/${g.id}`}>🖨️ Bill</Link>
              {g.canClose && <button className="primary" onClick={() => payTable(g.id)}>✅ Close Table</button>}
            </div>
          </div>
          <div className="orders">
            {g.list.map(o => <OrderCard key={o.id} order={o} onStatus={setStatus} onReorder={reorder} isNew={o.id === newestId} />)}
          </div>
        </section>
      ))}
      </div>
    </>
  );
}
