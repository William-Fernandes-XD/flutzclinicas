import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Point } from "../../types/api";

const COLORS = ["#7828c8", "#9f67e0", "#c4a0ef", "#2f855a", "#c05621", "#4a5568"];

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function TrendArea({ data, currency }: { data: Point[]; currency?: boolean }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-muted">Sem série no período selecionado.</p>;
  }
  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="flutzFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7828c8" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#7828c8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip
            formatter={(value) => (currency ? money(Number(value)) : String(value))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="valor" stroke="#7828c8" fill="url(#flutzFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data, currency }: { data: Point[]; currency?: boolean }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-muted">Ainda não há dados para este gráfico.</p>;
  }
  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip
            formatter={(value) => (currency ? money(Number(value)) : String(value))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="valor" fill="#7828c8" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SharePie({ data }: { data: Point[] }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-muted">Sem distribuição registrada.</p>;
  }
  return (
    <div className="h-64 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="valor" nameKey="rotulo" innerRadius={52} outerRadius={80} paddingAngle={3}>
            {data.map((item, index) => (
              <Cell key={item.rotulo} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Spark({ data }: { data: Point[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area type="monotone" dataKey="valor" stroke="#7828c8" fill="#f4e9ff" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
