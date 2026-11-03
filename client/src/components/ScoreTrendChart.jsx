// Small dependency-free line chart of quiz scores over time (CSQP-27).
// The same numbers are listed in the history table, so screen-reader users
// get the data from the table; the chart itself has a text summary.

import { useEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 640;
const PAD = { top: 16, right: 16, bottom: 16, left: 44 };

// Draw at the real on-screen width so labels stay readable on phones.
function useWidth(ref) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export default function ScoreTrendChart({ points }) {
  const ref = useRef(null);
  const WIDTH = useWidth(ref);
  const HEIGHT = WIDTH < 480 ? 180 : 220;

  if (!points?.length) return null;

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (pct) => PAD.top + innerH - (pct / 100) * innerH;

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.percentage)}`).join(' ');
  const first = points[0].percentage;
  const last = points[points.length - 1].percentage;
  const summary =
    points.length === 1
      ? `One quiz so far, scored ${last}%.`
      : `Score trend over ${points.length} quizzes, from ${first}% to ${last}%.`;

  return (
    <figure className="trend-chart" ref={ref}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={summary}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              className="trend-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="trend-axis" x={PAD.left - 8} y={y(tick) + 4} textAnchor="end">
              {tick}%
            </text>
          </g>
        ))}
        <path className="trend-line" d={path} />
        {points.map((p, i) => (
          <circle key={p.attemptId} className="trend-dot" cx={x(i)} cy={y(p.percentage)} r="5">
            <title>{`${p.quizTitle}: ${p.percentage}%`}</title>
          </circle>
        ))}
      </svg>
      <figcaption>{summary}</figcaption>
    </figure>
  );
}
