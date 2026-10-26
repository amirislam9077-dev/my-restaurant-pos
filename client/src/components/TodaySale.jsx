import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ORDER_TYPES, money } from '../orderTypes';

const today = () => new Date().toLocaleDateString('en-CA');

// "Today Sale" box on the POS: today's paid sales split by order type
export default function TodaySale({ onClose }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const day = today();

  useEffect(() => {
    api.report(day, day).then(setReport).catch(e => setError(e.message));
  }, [day]);

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
                <div key={t.type} className="ts-type">
                  <span>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</span>
                  <b>{money(t.sales)}</b>
                  <small>{t.orders} orders</small>
                </div>
              ))}
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
