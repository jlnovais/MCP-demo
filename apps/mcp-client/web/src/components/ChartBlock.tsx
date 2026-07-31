import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './ChartBlock.css';

export type ChartSpec = {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  xKey: string;
  yKeys: string[];
  data: Array<Record<string, string | number>>;
};

const SERIES_COLORS = [
  '#4f8cff',
  '#3ecf8e',
  '#f5a623',
  '#c77db5',
  '#4fd1c5',
  '#ff6b6b',
  '#b794f6',
];

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
} as const;

export function parseChartSpec(raw: string): ChartSpec | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const type = obj.type;
  if (type !== 'bar' && type !== 'line' && type !== 'pie') {
    return null;
  }

  const xKey = obj.xKey;
  if (typeof xKey !== 'string' || xKey.length === 0) {
    return null;
  }

  if (!Array.isArray(obj.yKeys) || obj.yKeys.length === 0) {
    return null;
  }
  if (!obj.yKeys.every((key) => typeof key === 'string' && key.length > 0)) {
    return null;
  }
  const yKeys = obj.yKeys as string[];

  if (!Array.isArray(obj.data) || obj.data.length === 0) {
    return null;
  }
  if (
    !obj.data.every(
      (row) => row !== null && typeof row === 'object' && !Array.isArray(row),
    )
  ) {
    return null;
  }
  const data = obj.data as Array<Record<string, string | number>>;

  const title = typeof obj.title === 'string' ? obj.title : undefined;

  return { type, title, xKey, yKeys, data };
}

type ChartBlockProps = {
  spec: ChartSpec;
};

function PieChartView({ spec }: ChartBlockProps) {
  const valueKey = spec.yKeys[0];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
        <Pie
          data={spec.data}
          dataKey={valueKey}
          nameKey={spec.xKey}
          cx="50%"
          cy="50%"
          outerRadius="75%"
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {spec.data.map((_, index) => (
            <Cell
              key={`${spec.xKey}-${index}`}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--text-muted)' }}
        />
        <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CartesianChartView({ spec }: ChartBlockProps) {
  const Chart = spec.type === 'bar' ? BarChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={spec.data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
        <XAxis
          dataKey={spec.xKey}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={{ stroke: 'var(--border)' }}
          width={48}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--text-muted)' }}
        />
        {spec.yKeys.length > 1 ? (
          <Legend wrapperStyle={{ color: 'var(--text-muted)', fontSize: 12 }} />
        ) : null}
        {spec.yKeys.map((key, index) => {
          const color = SERIES_COLORS[index % SERIES_COLORS.length];
          if (spec.type === 'bar') {
            return (
              <Bar key={key} dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
            );
          }
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 5 }}
            />
          );
        })}
      </Chart>
    </ResponsiveContainer>
  );
}

export function ChartBlock({ spec }: ChartBlockProps) {
  return (
    <div className="chart-block">
      {spec.title ? <div className="chart-block-title">{spec.title}</div> : null}
      <div className="chart-block-canvas">
        {spec.type === 'pie' ? (
          <PieChartView spec={spec} />
        ) : (
          <CartesianChartView spec={spec} />
        )}
      </div>
    </div>
  );
}
