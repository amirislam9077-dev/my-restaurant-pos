import { money } from '../../orderTypes';

// Fixed colors per entity (validated categorical slots 1 & 2; profit/loss = diverging blue/red)
export const COLORS = { sales: '#2a78d6', expenses: '#eb6834', profit: '#2a78d6', loss: '#e34948' };

export const short = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
export const rs = (n) => money(Math.round(n));

// Headline number tile
export function Kpi({ label, value, note, tone }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {note && <span>{note}</span>}
    </div>
  );
}

// Profit shown with a word and arrow, never color alone (text stays in normal ink, only the arrow is colored)
export function ProfitValue({ value }) {
  if (value === 0) return <span className="pl muted">{rs(0)}</span>;
  return value > 0
    ? <span className="pl"><i style={{ color: COLORS.profit }}>▲</i> Profit {rs(value)}</span>
    : <span className="pl"><i style={{ color: COLORS.loss }}>▼</i> Loss {rs(-value)}</span>;
}

// Inline share bar for table rows (magnitude only, one hue)
export function Share({ value, max }) {
  return (
    <span className="share">
      <span className="share-bar" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}
