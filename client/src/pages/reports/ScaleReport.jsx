import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import TrendCharts, { WEEKDAYS, hourRange, monthLabel, trendSummary } from '../../components/TrendCharts';
import { Kpi, Share, rs, pct } from './shared';

// Scale page: every paid sale as charts (daily, monthly, peak hours, peak days) + item-wise table
export default function ScaleReport() {
  const { from, to } = useOutletContext();
  const scope = 'all';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api.trends(from, to, scope).then(setData).catch(e => setError(e.message));
  }, [from, to, scope]);

  if (error) return <p className="error">{error}</p>;

  const scopeLabel = 'Sale';
  const sum = data && trendSummary(data);
  const orders = data ? data.daily.reduce((s, d) => s + d.orders, 0) : 0;
  const activeDays = data ? data.daily.filter(d => d.sales).length : 0;
  const thisMonth = data?.monthly[data.monthly.length - 1];
  const maxItem = data ? Math.max(0, ...data.items.map(i => i.sales)) : 0;

  return (
    <section className="scale-report">
      <div className="scale-report-head">
        <h2>📈 Sales Report at Scale</h2>
      </div>

      {!data && <p className="muted">Loading...</p>}
      {data && (
        <>
          <div className="kpis">
            <Kpi label="💰 Sale (chuni tarikhein)" value={rs(sum.total)} note={`${orders} orders · ${activeDays} din`} />
            <Kpi label="📅 Avg. per din" value={rs(activeDays ? sum.total / activeDays : 0)} note="sirf jin din sale hui" />
            <Kpi label="🗓️ Is mahine" value={rs(thisMonth?.sales || 0)} note={thisMonth ? monthLabel(thisMonth.month) : ''} />
            <Kpi label="⏰ Peak hour" value={sum.peaks[0] ? hourRange(sum.peaks[0].hour) : '-'} note={sum.peaks[0] ? rs(sum.peaks[0].sales) : 'Abhi data nahi'} />
            <Kpi label="📆 Peak day" value={sum.bestDays[0] ? WEEKDAYS[sum.bestDays[0].dow - 1] : '-'} note={sum.bestDays[0] ? rs(sum.bestDays[0].sales) : 'Abhi data nahi'} />
          </div>

          {!sum.total && (
            <p className="hint">
              {scope === 'scale'
                ? 'In tarikhon mein Scale (wazan wali cheezon) se koi sale nahi hui. Upar se item tol kar bechein, ya "🧾 Poori sale" dekhein.'
                : 'In tarikhon mein koi sale nahi hui.'}
            </p>
          )}

          <section className="rep-card">
            <h3>{scope === 'scale' ? '⚖️ Scale item-wise sale' : '🍔 Item-wise sale'}</h3>
            <table className="rep-table">
              <thead><tr><th>#</th><th>Item</th><th>{scope === 'scale' ? 'Kul wazan' : 'Qty'}</th><th>Sale</th><th>Hissa</th></tr></thead>
              <tbody>
                {data.items.map((i, n) => (
                  <tr key={i.id}>
                    <td>{n + 1}</td><td>{i.name}</td>
                    <td>{i.soldBy === 'kg' ? `${i.kg.toFixed(3)} kg` : i.qty}</td>
                    <td>{rs(i.sales)}</td>
                    <td><Share value={i.sales} max={maxItem} /> {pct(i.sales, sum.total)}%</td>
                  </tr>
                ))}
                {!data.items.length && <tr><td colSpan={5} className="muted">Abhi koi sale nahi</td></tr>}
              </tbody>
            </table>
          </section>

          {sum.total > 0 && <TrendCharts data={data} label="Sale" />}
        </>
      )}
    </section>
  );
}
