import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

const BRAND = ["#7828c8", "#9f67e0", "#c4a0ef", "#2f855a", "#c05621", "#4a5568", "#3182ce"];

export type ReportPoint = { rotulo: string; valor: number };

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
  if (!data.length) {
    return <EmptyChart />;
  }
  const option: EChartsOption = {
    color: BRAND,
    grid: { left: 48, right: 16, top: 24, bottom: 40 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => (currency ? money(Number(v)) : String(v)),
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.rotulo),
      axisLabel: { fontSize: 11, color: "#6e6680", rotate: data.length > 14 ? 35 : 0 },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 11, color: "#6e6680" }, splitLine: { lineStyle: { color: "#ebe4f4" } } },
    series: [
      {
        type: "line",
        smooth: true,
        areaStyle: { color: "rgba(120,40,200,0.12)" },
        data: data.map((d) => d.valor),
        symbolSize: 6,
      },
    ],
  };
  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: "canvas" }}
      onEvents={{
        click: (params: { name?: string }) => onSelect?.(params.name ?? null),
      }}
    />
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
  if (!data.length) {
    return <EmptyChart />;
  }
  const option: EChartsOption = {
    color: BRAND,
    grid: { left: 48, right: 16, top: 24, bottom: 64 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => (currency ? money(Number(v)) : String(v)),
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.rotulo),
      axisLabel: { fontSize: 11, color: "#6e6680", rotate: 25, interval: 12 },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 11, color: "#6e6680" }, splitLine: { lineStyle: { color: "#ebe4f4" } } },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.valor),
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  };
  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: "canvas" }}
      onEvents={{
        click: (params: { name?: string }) => onSelect?.(params.name ?? null),
      }}
    />
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
  if (!data.length) {
    return <EmptyChart />;
  }
  const option: EChartsOption = {
    color: BRAND,
    tooltip: { trigger: "item" },
    legend: { bottom: 0, type: "scroll", textStyle: { color: "#6e6680", fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "46%"],
        data: data.map((d) => ({ name: d.rotulo, value: d.valor })),
        label: { fontSize: 11 },
      },
    ],
  };
  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: "canvas" }}
      onEvents={{
        click: (params: { name?: string }) => onSelect?.(params.name ?? null),
      }}
    />
  );
}

function EmptyChart() {
  return <p className="py-12 text-center text-sm text-muted">Sem dados no período selecionado.</p>;
}
