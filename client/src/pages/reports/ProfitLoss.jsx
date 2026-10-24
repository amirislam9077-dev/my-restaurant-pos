import { useOutletContext } from 'react-router-dom';
import BarChart from '../../components/BarChart';
import { ORDER_TYPES } from '../../orderTypes';
import { COLORS, Kpi, ProfitValue, rs, short, pct } from './shared';

// Profit & loss statement: sales minus expenses
export default function ProfitLoss() {
  const { report } = useOutletContext();
  const { summary: s, daily, byType, expenseByCategory } = report;
  const profitDays = daily.filter(d => d.profit > 0).length;
  const lossDays = daily.filter(d => d.profit < 0).length;

  return (
    <>
      <div className="kpis">
        <Kpi label="💰 Sales" value={rs(s.sales)} />
        <Kpi label="🧾 Expenses" value={rs(s.expenses)} />
        <Kpi label="📈 Net" value={<ProfitValue value={s.profit} />} tone={s.profit >= 0 ? 'good' : 'bad'}
          note={s.sales ? `Margin ${pct(s.profit, s.sales)}%` : ''} />
        <Kpi label="📅 Days" value={`${profitDays} profit · ${lossDays} loss`} />
      </div>

      <section className="rep-card">
        <h3>Daily Profit / Loss</h3>
        <BarChart
          data={daily.map(d => ({ label: short(d.day), tip: `${short(d.day)} · Sales ${rs(d.sales)} − Exp ${rs(d.expenses)}`, values: [d.profit] }))}
          series={[{ name: 'Profit / Loss', color: COLORS.profit }]}
          legend={[{ name: '▲ Profit', color: COLORS.profit }, { name: '▼ Loss', color: COLORS.loss }]}
          colorFor={(v) => (v >= 0 ? COLORS.profit : COLORS.loss)}
          format={rs} height={230}
        />
      </section>

      <div className="rep-grid two">
        <section className="rep-card statement">
          <h3>Profit & Loss Statement</h3>
          <div className="st-head">Income (Sales)</div>
          {byType.map(t => (
            <div className="line" key={t.type}><span>{ORDER_TYPES[t.type].icon} {ORDER_TYPES[t.type].label}</span><span>{rs(t.sales)}</span></div>
          ))}
          <div className="line st-sub"><span>Total Sales</span><span>{rs(s.sales)}</span></div>

          <div className="st-head">Expenses</div>
          {expenseByCategory.map(c => (
            <div className="line" key={c.category}><span>{c.category}</span><span>− {rs(c.amount)}</span></div>
          ))}
          {!expenseByCategory.length && <div className="line muted"><span>No expenses recorded</span><span>{rs(0)}</span></div>}
          <div className="line st-sub"><span>Total Expenses</span><span>− {rs(s.expenses)}</span></div>

          <div className={`line st-net ${s.profit >= 0 ? 'good' : 'bad'}`}>
            <span>{s.profit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</span><span>{rs(Math.abs(s.profit))}</span>
          </div>
        </section>


      <section className="rep-card">
        <h3>Daily breakdown</h3>
        <table className="rep-table">
          <thead><tr><th>Date</th><th>Sales</th><th>Expenses</th><th>Profit / Loss</th></tr></thead>
          <tbody>
            {[...daily].reverse().map(d => (
              <tr key={d.day}>
                <td>{short(d.day)}</td><td>{rs(d.sales)}</td><td>{rs(d.expenses)}</td>
                <td><ProfitValue value={d.profit} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td>{rs(s.sales)}</td><td>{rs(s.expenses)}</td><td><ProfitValue value={s.profit} /></td></tr></tfoot>
        </table>
      </section>
      </div>
    </>
  );
}
