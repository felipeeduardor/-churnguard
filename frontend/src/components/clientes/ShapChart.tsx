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
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURE_LABELS: Record<string, string> = {
  recencia_dias: "Recência (dias)",
  vl_nota_sum: "Receita Total",
  frequencia_compras: "Frequência",
  ticket_medio: "Ticket Médio",
  custo_medio_mean: "Custo Médio",
  qtd_prd_nota_sum: "Qtd. Produtos",
  regiao_NORTE_max: "Região: Norte",
  regiao_NORDESTE_max: "Região: Nordeste",
  regiao_SUDESTE_max: "Região: Sudeste",
  regiao_SUL_max: "Região: Sul",
  regiao_EXTERIOR_max: "Região: Exterior",
};

interface Props {
  shapValues: Record<string, number>;
}

export function ShapChart({ shapValues }: Props) {
  const data = Object.entries(shapValues)
    .map(([feature, value]) => ({
      feature: FEATURE_LABELS[feature] ?? feature,
      value: parseFloat(value.toFixed(4)),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fatores de Churn (SHAP)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Vermelho = aumenta risco | Verde = reduz risco
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(data.length * 36, 200)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 120, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="feature"
              tick={{ fontSize: 11 }}
              width={115}
            />
            <Tooltip formatter={(v: number) => [v.toFixed(4), "SHAP"]} />
            <ReferenceLine x={0} stroke="#666" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.value >= 0 ? "#ef4444" : "#22c55e"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
