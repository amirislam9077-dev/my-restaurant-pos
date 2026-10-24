import BarChart from './BarChart';
import { COLORS, rs, short, pct } from '../pages/reports/shared';

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
export const hourRange = (h) => `${hourLabel(h)} – ${hourLabel((h + 1) % 24)}`;
export const monthLabel = (m) => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

// Peak hours and weekdays ranked by sales (only ones that had sales)
export function trendSummary(data) {
  const total = data.daily.reduce((s, d) => s + d.sales, 0);
  const peaks = [...data.byHour].filter(h => h.sales).sort((a, b) => b.sales - a.sales);
  const week = [...data.byWeekday.slice(1), data.byWeekday[0]]; // Monday first
  const bestDays = [...week].filter(w => w.sales).sort((a, b) => b.sales - a.sales);
  return { total, peaks, week, bestDays };
}

// Full-width bar charts: daily, monthly (12 months), peak hours, peak days
export default function TrendCharts({ data, label = 'Sale' }) {
  const { total, peaks, week, bestDays } = trendSummary(data);
  const series = [{ name: label, color: COLORS.sales }];
  const withSales = data.byHour.filter(h => h.sales).map(h => h.hour);
  const hours = withSales.length
    ? data.byHour.slice(Math.min(...withSales), Math.max(...withSales) + 1)
    : [];

  return (
    <>
      <section className="rep-card">
        <h3>📅 Daily sale</h3>
        <BarChart data={data.daily.map(d => ({ label: short(d.day), tip: `${short(d.day)} · ${d.orders} orders`, values: [d.sales] }))}
          series={series} format={rs} height={240} />
      </section>

      <section className="rep-card">
        <h3>🗓️ Monthly sale (pichhle 12 mahine)</h3>
        <BarChart data={data.monthly.map(m => ({ label: monthLabel(m.month), tip: `${monthLabel(m.month)} · ${m.orders} orders`, values: [m.sales] }))}
          series={series} format={rs} height={240} />
      </section>

      <section className="rep-card">
        <h3>⏰ Peak hours (kis waqt zyada sale hoti hai)</h3>
        {hours.length > 0 ? (
          <div className="trend-split">
            <BarChart data={hours.map(h => ({ label: hourLabel(h.hour), tip: `${hourRange(h.hour)} · ${h.orders} orders`, values: [h.sales] }))}
              series={series} format={rs} height={240} />
            <ol className="peak-list">
              {peaks.slice(0, 5).map((h, n) => (
                <li key={h.hour}>
                  <b>#{n + 1} {hourRange(h.hour)}</b>
                  <span>{rs(h.sales)} · {h.orders} orders · {pct(h.sales, total)}%</span>
                </li>
              ))}
            </ol>
          </div>
        ) : <p className="muted">In tarikhon mein koi sale nahi</p>}
      </section>

      <section className="rep-card">
        <h3>📆 Peak days (kis din zyada sale hoti hai)</h3>
        <div className="trend-split">
          <BarChart data={week.map(w => ({ label: WEEKDAYS[w.dow - 1].slice(0, 3), tip: `${WEEKDAYS[w.dow - 1]} · ${w.orders} orders · ${w.days} din`, values: [w.sales] }))}
            series={series} format={rs} height={240} />
          <ol className="peak-list">
            {bestDays.map((w, n) => (
              <li key={w.dow}>
                <b>#{n + 1} {WEEKDAYS[w.dow - 1]}</b>
                <span>{rs(w.sales)} · avg. {rs(w.sales / w.days)} per din</span>
              </li>
            ))}
            {!bestDays.length && <li className="muted">In tarikhon mein koi sale nahi</li>}
          </ol>
        </div>
      </section>
    </>
  );
}
