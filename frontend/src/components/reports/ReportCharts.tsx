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

const BRAND = ["#7828c8", "#9f67e0", "#c4a0ef", "#2f855a", "#c05621", "#4a5568", "#3182ce"];

export type ReportPoint = { rotulo: string; valor: number };

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function EmptyChart() {
  return <p className="py-12 text-center text-sm text-muted">Sem dados no período selecionado.</p>;
}

export function ReportLineChart({
  data,
  currency,
  onSelect,
  height = 280,
}: {
  data: ReportPoint[];
  currency?: boolean;
  onSelect?: (rotulo: string | null) => void;
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <div style={{ height }} className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          onClick={(state) => {
            const rotulo = (state?.activeLabel as string | undefined) ?? null;
            onSelect?.(rotulo);
          }}
        >
          <defs>
            <linearGradient id="reportLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7828c8" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#7828c8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ebe4f4" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#6e6680" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#6e6680" }} width={48} />
          <Tooltip
            formatter={(value) => (currency ? money(Number(value)) : String(value))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Area type="monotone" dataKey="valor" stroke="#7828c8" fill="url(#reportLineFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportBarChart({
  data,
  currency,
  onSelect,
  height = 280,
}: {
  data: ReportPoint[];
  currency?: boolean;
  onSelect?: (rotulo: string | null) => void;
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <div style={{ height }} className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          onClick={(state) => {
            const rotulo = (state?.activeLabel as string | undefined) ?? null;
            onSelect?.(rotulo);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ebe4f4" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#6e6680" }} interval={0} angle={-25} textAnchor="end" height={64} />
          <YAxis tick={{ fontSize: 11, fill: "#6e6680" }} width={48} />
          <Tooltip
            formatter={(value) => (currency ? money(Number(value)) : String(value))}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="valor" fill="#7828c8" radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportPieChart({
  data,
  onSelect,
  height = 280,
}: {
  data: ReportPoint[];
  onSelect?: (rotulo: string | null) => void;
  height?: number;
}) {
  if (!data.length) return <EmptyChart />;
  return (
    <div style={{ height }} className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="rotulo"
            innerRadius="42%"
            outerRadius="68%"
            paddingAngle={3}
            onClick={(_, index) => onSelect?.(data[index]?.rotulo ?? null)}
          >
            {data.map((item, index) => (
              <Cell key={item.rotulo} fill={BRAND[index % BRAND.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
