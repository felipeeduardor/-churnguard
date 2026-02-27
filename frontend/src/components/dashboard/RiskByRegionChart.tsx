"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prediction } from "@/types";

interface Props {
  predictions: Prediction[];
}

export function RiskByRegionChart({ predictions }: Props) {
  const regionMap: Record<string, { total: number; sum: number }> = {};

  for (const p of predictions) {
    const region = p.regiao || "Desconhecido";
    if (!regionMap[region]) regionMap[region] = { total: 0, sum: 0 };
    regionMap[region].total++;
    regionMap[region].sum += p.probabilidade_churn;
  }

  const data = Object.entries(regionMap)
    .map(([region, { total, sum }]) => ({
      region,
      avgChurn: Math.round((sum / total) * 100),
      total,
    }))
    .sort((a, b) => b.avgChurn - a.avgChurn);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risco Médio por Região</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 48, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="region" tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: number) => [`${v}%`, "Risco médio"]} />
            <Bar dataKey="avgChurn" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
