import { useEffect, useRef, useState } from 'react';

// Round step (1, 2, 2.5, 5 x 10^n) so axis labels are clean numbers and 0 is always a tick
function niceStep(range, count) {
  const raw = range / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map(m => m * pow).find(st => st >= raw) || raw;
}

// Narrower drawing when the chart's own box is small (phones, half-width cards) so axis text stays readable
function useNarrow(ref) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    if (!ref.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
}

// Small SVG bar chart: grouped series, zero baseline (handles negatives), hover tooltip.
// data:   [{ label, values: [n, ...] }]   one value per series
// series: [{ name, color }]               colors are fixed per entity, never by rank
// colorFor(value, seriesIndex) optional   per-bar color (e.g. profit vs loss)
export default function BarChart({ data, series, format = (v) => v, colorFor, height = 220, legend }) {
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const narrow = useNarrow(boxRef);
  const W = narrow ? 420 : 720, H = narrow ? Math.round(height * 0.85) : height;
  const pad = { top: 12, right: 8, bottom: 26, left: narrow ? 70 : 76 };
  const plotW = W - pad.left - pad.right, plotH = H - pad.top - pad.bottom;

  const all = data.flatMap(d => d.values);
  const step = niceStep(Math.max(0, ...all) - Math.min(0, ...all) || 1, 4);
  const max = Math.ceil(Math.max(0, ...all) / step) * step || step;
  const min = Math.floor(Math.min(0, ...all) / step) * step;
  const span = max - min;
  const y = (v) => pad.top + ((max - v) / span) * plotH;
  const zero = y(0);

  const groupW = plotW / Math.max(1, data.length);
  const gap = 2; // surface gap between neighbouring bars
  const barW = Math.max(2, Math.min(28, (groupW * 0.7 - gap * (series.length - 1)) / series.length));
  const groupInner = barW * series.length + gap * (series.length - 1);

  const ticks = Array.from({ length: Math.round(span / step) + 1 }, (_, i) => min + i * step);
  const labelEvery = Math.ceil(data.length / (narrow ? 8 : 12)); // keep x labels readable

  // Bar with rounded data-end (top for positive, bottom for negative), flat at the baseline
  const bar = (x, v) => {
    const r = Math.min(4, barW / 2, Math.abs(y(v) - zero));
    if (v >= 0) {
      const top = y(v);
      return `M${x},${zero} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${zero} Z`;
    }
    const bottom = y(v);
    return `M${x},${zero} V${bottom - r} Q${x},${bottom} ${x + r},${bottom} H${x + barW - r} Q${x + barW},${bottom} ${x + barW},${bottom - r} V${zero} Z`;
  };

  return (
    <div className="chart">
      {(legend ?? series.length > 1) && (
        <div className="chart-legend">
          {(Array.isArray(legend) ? legend : series).map(s => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
      <div className="chart-box" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map(s => s.name).join(', ')} onMouseLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-zero' : 'chart-grid'} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{format(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const gx = pad.left + i * groupW + (groupW - groupInner) / 2;
            return (
              <g key={d.label} onMouseEnter={() => setHover(i)}>
                {/* hit target: the whole column, bigger than the bars */}
                <rect x={pad.left + i * groupW} y={pad.top} width={groupW} height={plotH} fill="transparent" />
                {hover === i && <rect x={pad.left + i * groupW} y={pad.top} width={groupW} height={plotH} className="chart-hover" />}
                {d.values.map((v, s) => v !== 0 && (
                  <path key={s} d={bar(gx + s * (barW + gap), v)} fill={colorFor ? colorFor(v, s) : series[s].color} />
                ))}
                {i % labelEvery === 0 && (
                  <text x={pad.left + i * groupW + groupW / 2} y={H - 8} textAnchor="middle" className="chart-axis">{d.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div className="chart-tip" style={{ left: `${((pad.left + (hover + 0.5) * groupW) / W) * 100}%` }}>
            <b>{data[hover].tip || data[hover].label}</b>
            {series.map((s, i) => (
              <div key={s.name}>
                <i style={{ background: colorFor ? colorFor(data[hover].values[i], i) : s.color }} />
                {s.name}: <b>{format(data[hover].values[i])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
