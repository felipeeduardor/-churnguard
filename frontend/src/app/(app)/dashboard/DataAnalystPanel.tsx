"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAnalyticsInsights } from "@/lib/api";
import type { AnalyticsInsightsResponse, Prediction } from "@/types";
import {
  Bot,
  Loader2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface Props {
  predictions: Prediction[];
  orgId: string;
}

const IMPACTO_COLOR = {
  alto: "border-red-200 bg-red-50 text-red-900",
  medio: "border-yellow-200 bg-yellow-50 text-yellow-900",
  baixo: "border-green-200 bg-green-50 text-green-900",
};

const PRIORIDADE_COLOR = {
  alta: "bg-red-100 text-red-700",
  media: "bg-yellow-100 text-yellow-700",
  baixa: "bg-green-100 text-green-700",
};

export function DataAnalystPanel({ predictions, orgId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      // Build derived statistics from predictions
      const segmentos: Record<string, number> = {};
      const regiaoRisco: Record<string, { sum: number; count: number }> = {};
      let recenciaTotal = 0;

      for (const p of predictions) {
        segmentos[p.segmento] = (segmentos[p.segmento] || 0) + 1;
        if (!regiaoRisco[p.regiao]) regiaoRisco[p.regiao] = { sum: 0, count: 0 };
        regiaoRisco[p.regiao].sum += p.probabilidade_churn;
        regiaoRisco[p.regiao].count++;
        recenciaTotal += p.recencia_dias;
      }

      const riscoPorRegiao: Record<string, number> = {};
      for (const [r, v] of Object.entries(regiaoRisco)) {
        riscoPorRegiao[r] = v.sum / v.count;
      }

      const receitaEmRisco = predictions
        .filter((p) => p.probabilidade_churn > 0.6)
        .reduce((s, p) => s + p.vl_nota_sum, 0);

      const topClientes = predictions
        .sort((a, b) => b.probabilidade_churn - a.probabilidade_churn)
        .slice(0, 5)
        .map((p) => ({ codcli: p.codcli, prob: p.probabilidade_churn, receita: p.vl_nota_sum }));

      const res = await getAnalyticsInsights({
        org_id: orgId,
        total_clientes: predictions.length,
        distribuicao_segmentos: segmentos,
        risco_por_regiao: riscoPorRegiao,
        receita_em_risco: receitaEmRisco,
        media_recencia_dias: predictions.length > 0 ? recenciaTotal / predictions.length : 0,
        top_clientes_risco: topClientes,
      }) as AnalyticsInsightsResponse;

      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro no agente de análise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agente IA — Analista de Dados
          </CardTitle>
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={loading || predictions.length === 0}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {loading ? "Gerando..." : "Gerar Insights com IA"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {error && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}

      {result && expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Executive summary */}
          <div className="rounded-md bg-background border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Resumo Executivo
            </p>
            <p className="text-sm leading-relaxed">{result.resumo_executivo}</p>
          </div>

          {/* Alerts */}
          {result.alertas?.length > 0 && (
            <div className="space-y-1">
              {result.alertas.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-900"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Insights */}
          {result.insights?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Insights ({result.insights.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.insights.map((ins, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-3 text-sm ${IMPACTO_COLOR[ins.impacto] ?? IMPACTO_COLOR.baixo}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold">{ins.titulo}</span>
                      <span className="ml-auto text-xs opacity-70">{ins.impacto}</span>
                    </div>
                    <p className="text-xs opacity-80">{ins.descricao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recomendacoes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Recomendações ({result.recomendacoes.length})
              </p>
              <div className="space-y-2">
                {result.recomendacoes.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm">
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${PRIORIDADE_COLOR[r.prioridade] ?? PRIORIDADE_COLOR.media}`}
                    >
                      {r.prioridade}
                    </span>
                    <div>
                      <p className="font-medium">{r.acao}</p>
                      <p className="text-xs text-muted-foreground">{r.impacto_estimado}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.acoes_tomadas?.length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              Ferramentas: {result.acoes_tomadas.join(" · ")}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
