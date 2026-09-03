"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* Hex values (not CSS vars) so Recharts' SVG renders identically in headless
   screenshot tooling and in tooltips. Derived from the brand tokens. */
export const CHART = {
  blue: "#034ea2",
  sky: "#358ccb",
  wave: "#52a4ca",
  cyan: "#5dc1d4",
  grey: "#a7a9ac",
  ok: "#1a6b39",
  warn: "#8a5a06",
  bad: "#a12525",
  line: "#e3e8ef",
  ink: "#616161",
};

export type BarDatum = { label: string; value: number; color?: string; hint?: string };

export function BrandBarChart({
  data,
  format = "number",
  height = 220,
  color = CHART.blue,
  currency = "USD",
}: {
  data: BarDatum[];
  format?: "number" | "money";
  height?: number;
  color?: string;
  currency?: string;
}) {
  const fmt = (v: number) =>
    format === "money"
      ? new Intl.NumberFormat("en-US", { style: "currency", currency, notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 0 }).format(v)
      : new Intl.NumberFormat("en-US", { notation: v >= 10000 ? "compact" : "standard" }).format(v);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={CHART.line} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: CHART.line }} tick={{ fontSize: 11.5, fill: CHART.ink }} interval={0} />
          <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: CHART.ink }} tickFormatter={fmt} />
          <Tooltip
            cursor={{ fill: "#e8f0f8" }}
            contentStyle={{ borderRadius: 5, border: `1px solid ${CHART.line}`, fontSize: 12.5, boxShadow: "0 1px 3px rgba(3,78,162,.08)" }}
            formatter={(v) => [fmt(Number(v)), ""]}
            labelFormatter={(l, payload) => {
              const p = payload?.[0]?.payload as BarDatum | undefined;
              return p?.hint ? `${l} · ${p.hint}` : String(l);
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
