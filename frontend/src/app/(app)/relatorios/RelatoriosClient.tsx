"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ScienceEngineerPanel } from "./ScienceEngineerPanel";
import type { Prediction } from "@/types";

interface Props {
  predictions: Prediction[];
}

function exportToCsv(predictions: Prediction[]) {
  const headers = [
    "codcli",
    "probabilidade_churn",
    "segmento",
    "regiao",
    "vl_nota_sum",
    "frequencia_compras",
    "ticket_medio",
    "recencia_dias",
  ];
  const rows = predictions.map((p) =>
    [
      p.codcli,
      p.probabilidade_churn,
      p.segmento,
      p.regiao,
      p.vl_nota_sum,
      p.frequencia_compras,
      p.ticket_medio,
      p.recencia_dias,
    ].join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `churn_predictions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatoriosClient({ predictions }: Props) {
  // Group by upload date for evolution chart
  const byDate: Record<string, { total: number; highRisk: number; avgProb: number }> = {};

  for (const p of predictions) {
    const date = p.created_at ? p.created_at.slice(0, 10) : "unknown";
    if (!byDate[date]) byDate[date] = { total: 0, highRisk: 0, avgProb: 0 };
    byDate[date].total++;
    if (p.probabilidade_churn > 0.6) byDate[date].highRisk++;
    byDate[date].avgProb += p.probabilidade_churn;
  }

  const evolutionData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      "Prob. Média": Math.round((stats.avgProb / stats.total) * 100) / 100,
      "Risco Alto (%)": Math.round((stats.highRisk / stats.total) * 100),
    }));

  // Summary by segment
  const bySegmento = predictions.reduce<Record<string, number>>((acc, p) => {
    acc[p.segmento] = (acc[p.segmento] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl">
      {/* AI Science & Engineering Panel */}
      <ScienceEngineerPanel predictions={predictions} />
      {/* Export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dados exportáveis</h2>
          <p className="text-sm text-muted-foreground">
            {predictions.length} registros disponíveis
          </p>
        </div>
        <Button
          onClick={() => exportToCsv(predictions)}
          disabled={predictions.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Evolution chart */}
      {evolutionData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do Churn por Data de Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Risco Alto (%)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Prob. Média"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Segment summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo por Segmento</CardTitle>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma predição encontrada. Faça um upload primeiro.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: "sem_risco", label: "Sem Risco", color: "bg-green-100 text-green-800" },
                { key: "baixo", label: "Baixo", color: "bg-lime-100 text-lime-800" },
                { key: "medio", label: "Médio", color: "bg-yellow-100 text-yellow-800" },
                { key: "alto", label: "Alto", color: "bg-orange-100 text-orange-800" },
                { key: "critico", label: "Crítico", color: "bg-purple-100 text-purple-800" },
              ].map(({ key, label, color }) => (
                <div key={key} className={`rounded-lg p-4 ${color}`}>
                  <div className="text-2xl font-bold">{bySegmento[key] ?? 0}</div>
                  <div className="text-sm font-medium mt-1">{label}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {predictions.length > 0
                      ? `${Math.round(((bySegmento[key] ?? 0) / predictions.length) * 100)}%`
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
