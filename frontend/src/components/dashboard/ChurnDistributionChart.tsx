"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prediction } from "@/types";

interface Props {
  predictions: Prediction[];
}

const BINS = [
  { range: "0–20%", min: 0, max: 0.2, color: "#22c55e" },
  { range: "20–40%", min: 0.2, max: 0.4, color: "#84cc16" },
  { range: "40–60%", min: 0.4, max: 0.6, color: "#f59e0b" },
  { range: "60–80%", min: 0.6, max: 0.8, color: "#ef4444" },
  { range: "80–100%", min: 0.8, max: 1.0, color: "#7c3aed" },
];

export function ChurnDistributionChart({ predictions }: Props) {
  const data = BINS.map((bin) => ({
    name: bin.range,
    value: predictions.filter(
      (p) => p.probabilidade_churn >= bin.min && p.probabilidade_churn < bin.max
    ).length,
    color: bin.color,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição de Risco de Churn</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => [`${value} clientes`, "Clientes"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
