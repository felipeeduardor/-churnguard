"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getAnalyticsInsights, evaluateScience, reviewEngineering } from "@/lib/api";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type {
  Prediction,
  AnalyticsInsightsResponse,
  ScienceEvaluateResponse,
  EngineeringReviewResponse,
} from "@/types";
import {
  FileText,
  Loader2,
  Printer,
  Users,
  AlertTriangle,
  DollarSign,
  Flame,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Bot,
  FlaskConical,
  Cpu,
  BarChart3,
} from "lucide-react";

interface Props {
  predictions: Prediction[];
  orgId: string;
}

interface ReportData {
  analytics: AnalyticsInsightsResponse;
  science: ScienceEvaluateResponse;
  engineering: EngineeringReviewResponse;
  generatedAt: string;
}

const SAUDE_CONFIG = {
  saudavel: {
    label: "Saudável",
    color: "text-green-600",
    badgeClass: "bg-green-100 text-green-800",
  },
  atencao: {
    label: "Atenção",
    color: "text-yellow-600",
    badgeClass: "bg-yellow-100 text-yellow-800",
  },
  retreinar: {
    label: "Retreinar",
    color: "text-red-600",
    badgeClass: "bg-red-100 text-red-800",
  },
};

const IMPACTO_COLORS: Record<string, string> = {
  alto: "bg-red-100 text-red-800",
  medio: "bg-yellow-100 text-yellow-800",
  baixo: "bg-blue-100 text-blue-800",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-red-100 text-red-800",
  media: "bg-yellow-100 text-yellow-800",
  baixa: "bg-green-100 text-green-800",
};

export function FullReportPanel({ predictions, orgId }: Props) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived KPIs
  const totalClientes = predictions.length;
  const altosRisco = predictions.filter((p) => p.probabilidade_churn > 0.6).length;
  const pctAltoRisco = totalClientes > 0 ? altosRisco / totalClientes : 0;
  const receitaEmRisco = predictions
    .filter((p) => p.probabilidade_churn > 0.6)
    .reduce((s, p) => s + p.vl_nota_sum, 0);
  const criticos = predictions.filter((p) => p.segmento === "critico").length;
  const mediaRecencia =
    totalClientes > 0
      ? predictions.reduce((s, p) => s + p.recencia_dias, 0) / totalClientes
      : 0;

  async function generateReport() {
    if (predictions.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Segment distribution
      const bySegmento = predictions.reduce<Record<string, number>>((acc, p) => {
        acc[p.segmento] = (acc[p.segmento] || 0) + 1;
        return acc;
      }, {});

      // Risk by region (avg probability)
      const regiaoSums: Record<string, { sum: number; count: number }> = {};
      for (const p of predictions) {
        if (!regiaoSums[p.regiao]) regiaoSums[p.regiao] = { sum: 0, count: 0 };
        regiaoSums[p.regiao].sum += p.probabilidade_churn;
        regiaoSums[p.regiao].count++;
      }
      const riscoPorRegiao: Record<string, number> = {};
      for (const [r, s] of Object.entries(regiaoSums)) {
        riscoPorRegiao[r] = s.sum / s.count;
      }

      // Top 5 clients by risk
      const topClientes = [...predictions]
        .sort((a, b) => b.probabilidade_churn - a.probabilidade_churn)
        .slice(0, 5)
        .map((p) => ({ codcli: p.codcli, prob: p.probabilidade_churn, receita: p.vl_nota_sum }));

      // Probability distribution buckets
      const dist: Record<string, number> = {
        "0-20": 0,
        "20-40": 0,
        "40-60": 0,
        "60-80": 0,
        "80-100": 0,
      };
      for (const p of predictions) {
        const pct = p.probabilidade_churn * 100;
        if (pct <= 20) dist["0-20"]++;
        else if (pct <= 40) dist["20-40"]++;
        else if (pct <= 60) dist["40-60"]++;
        else if (pct <= 80) dist["60-80"]++;
        else dist["80-100"]++;
      }
      const total = predictions.length || 1;
      for (const k of Object.keys(dist)) dist[k] /= total;

      // Average SHAP values across all predictions
      const shapSums: Record<string, number> = {};
      const shapCount: Record<string, number> = {};
      for (const p of predictions) {
        for (const [k, v] of Object.entries(p.shap_values ?? {})) {
          shapSums[k] = (shapSums[k] || 0) + v;
          shapCount[k] = (shapCount[k] || 0) + 1;
        }
      }
      const shapMedias: Record<string, number> = {};
      for (const k of Object.keys(shapSums)) {
        shapMedias[k] = shapSums[k] / shapCount[k];
      }

      // Fire all 3 agents in parallel
      const [analytics, science, engineering] = await Promise.all([
        getAnalyticsInsights({
          org_id: orgId || "default",
          total_clientes: totalClientes,
          distribuicao_segmentos: bySegmento,
          risco_por_regiao: riscoPorRegiao,
          receita_em_risco: receitaEmRisco,
          media_recencia_dias: mediaRecencia,
          top_clientes_risco: topClientes,
        }) as Promise<AnalyticsInsightsResponse>,
        evaluateScience({
          total_predicoes: totalClientes,
          distribuicao_probabilidades: dist,
          shap_medias: shapMedias,
        }) as Promise<ScienceEvaluateResponse>,
        reviewEngineering({
          volume_dados: { total_clientes: totalClientes },
          pipeline_steps: ["aggregation", "scaling", "prediction", "shap"],
        }) as Promise<EngineeringReviewResponse>,
      ]);

      setReport({
        analytics,
        science,
        engineering,
        generatedAt: new Date().toLocaleString("pt-BR"),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  function exportPDF() {
    if (!report) return;
    const win = window.open("", "_blank", "width=960,height=720");
    if (!win) return;

    const saude = SAUDE_CONFIG[report.science.saude_modelo] ?? SAUDE_CONFIG.saudavel;

    const badgeColor = (val: string, map: Record<string, string>) =>
      map[val] ?? "background:#f1f5f9;color:#475569";

    const impactoBadge = (val: string) => {
      const colors: Record<string, string> =
        { alto: "background:#fee2e2;color:#991b1b", medio: "background:#fef9c3;color:#854d0e", baixo: "background:#dbeafe;color:#1e40af" };
      return colors[val] ?? "background:#f1f5f9;color:#475569";
    };

    const prioridadeBadge = (val: string) => {
      const colors: Record<string, string> =
        { alta: "background:#fee2e2;color:#991b1b", media: "background:#fef9c3;color:#854d0e", baixa: "background:#dcfce7;color:#166534" };
      return colors[val] ?? "background:#f1f5f9;color:#475569";
    };

    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório ChurnGuard — ${report.generatedAt}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 40px 48px; font-size: 14px; line-height: 1.6; }
    header { border-bottom: 3px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
    header h1 { font-size: 24px; color: #6366f1; }
    header p { color: #64748b; font-size: 12px; margin-top: 4px; }
    h2 { font-size: 15px; font-weight: 700; color: #6366f1; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 28px 0 14px; }
    h3 { font-size: 13px; font-weight: 600; color: #334155; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
    p { margin-bottom: 10px; white-space: pre-wrap; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
    .kpi-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .kpi-val { font-size: 22px; font-weight: 700; }
    .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 10px; background: #fff; }
    .alert { border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
    .alert-yellow { background: #fffbeb; border: 1px solid #fde68a; color: #78350f; }
    .alert-red { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .alert-blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    td:first-child { color: #64748b; width: 40%; }
    .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 8px 0; }
    .progress-fill { height: 100%; background: #6366f1; border-radius: 4px; }
    .row { display: flex; align-items: start; justify-content: space-between; gap: 12px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px; }
    .row-title { font-weight: 600; font-size: 13px; }
    .row-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
    footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 20px 24px; } }
  </style>
</head>
<body>
  <header>
    <h1>Relatório Completo de Churn</h1>
    <p>Gerado em ${report.generatedAt} &nbsp;·&nbsp; ${totalClientes.toLocaleString("pt-BR")} clientes analisados &nbsp;·&nbsp; 3 agentes IA (Groq / Llama 3.3 70B)</p>
  </header>

  <!-- KPIs -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Total de Clientes</div>
      <div class="kpi-val">${totalClientes.toLocaleString("pt-BR")}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Em Risco Alto</div>
      <div class="kpi-val" style="color:#dc2626">${formatPercent(pctAltoRisco)}</div>
      <div class="kpi-sub">${altosRisco} clientes</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Receita em Risco</div>
      <div class="kpi-val" style="color:#d97706">${formatCurrency(receitaEmRisco)}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Clientes Críticos</div>
      <div class="kpi-val" style="color:#7c3aed">${criticos}</div>
    </div>
  </div>

  <!-- ── 1. Executive Summary (Agent 3) ── -->
  <h2>1. Resumo Executivo — Analista de Dados</h2>
  <p>${report.analytics.resumo_executivo}</p>

  ${report.analytics.alertas?.length > 0 ? `
  <h3>Alertas Principais</h3>
  ${report.analytics.alertas.map((a) => `<div class="alert alert-yellow">${a}</div>`).join("")}
  ` : ""}

  ${report.analytics.insights?.length > 0 ? `
  <h3>Insights Identificados</h3>
  ${report.analytics.insights.map((ins) => `
  <div class="row">
    <div>
      <div class="row-title">${ins.titulo}</div>
      <div class="row-desc">${ins.descricao}</div>
    </div>
    <span class="badge" style="${impactoBadge(ins.impacto)}">${ins.impacto}</span>
  </div>`).join("")}
  ` : ""}

  ${report.analytics.recomendacoes?.length > 0 ? `
  <h3>Recomendações Estratégicas</h3>
  ${report.analytics.recomendacoes.map((rec) => `
  <div class="row">
    <div>
      <div class="row-title">${rec.acao}</div>
      <div class="row-desc">${rec.impacto_estimado}</div>
    </div>
    <span class="badge" style="${prioridadeBadge(rec.prioridade)}">${rec.prioridade}</span>
  </div>`).join("")}
  ` : ""}

  <!-- ── 2. Model Health (Agent 4) ── -->
  <h2>2. Saúde do Modelo — Cientista de Dados</h2>
  <table>
    <tr><td>Status</td><td><span class="badge" style="${badgeColor(report.science.saude_modelo, { saudavel: "background:#dcfce7;color:#166534", atencao: "background:#fef9c3;color:#854d0e", retreinar: "background:#fee2e2;color:#991b1b" })}">${saude.label}</span></td></tr>
    <tr><td>Score de Saúde</td><td><strong>${Math.round(report.science.score_saude * 100)}%</strong></td></tr>
    <tr><td>Data Drift</td><td>${report.science.drift_detectado ? `Detectado — features: ${report.science.features_em_drift.join(", ")}` : "Não detectado"}</td></tr>
  </table>
  <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(report.science.score_saude * 100)}%"></div></div>
  <p>${report.science.analysis}</p>
  <div class="alert alert-blue"><strong>Recomendação: </strong>${report.science.recomendacao}</div>

  <!-- ── 3. Engineering Review (Agent 5) ── -->
  <h2>3. Revisão de Engenharia — Engenheiro de IA</h2>

  ${report.engineering.problemas_criticos?.length > 0 ? `
  <h3>Problemas Críticos</h3>
  ${report.engineering.problemas_criticos.map((p) => `<div class="alert alert-red">${p}</div>`).join("")}
  ` : ""}

  <p>${report.engineering.analysis}</p>

  ${report.engineering.melhorias_prioritarias?.length > 0 ? `
  <h3>Melhorias Prioritárias</h3>
  ${report.engineering.melhorias_prioritarias.map((m) => `
  <div class="row">
    <div class="row-title">${m.titulo}</div>
    <div style="display:flex;gap:6px">
      <span class="badge" style="${impactoBadge(m.impacto)}">impacto: ${m.impacto}</span>
      <span class="badge" style="background:#f1f5f9;color:#475569">esforço: ${m.esforco}</span>
    </div>
  </div>`).join("")}
  ` : ""}

  ${report.engineering.roadmap?.length > 0 ? `
  <h3>Roadmap Técnico</h3>
  ${report.engineering.roadmap.map((r) => `
  <div class="card">
    <strong style="color:#6366f1">v${r.versao}</strong>
    <ul style="padding-left:18px;margin-top:6px;font-size:12px;color:#475569">
      ${r.features.map((f) => `<li>${f}</li>`).join("")}
    </ul>
  </div>`).join("")}
  ` : ""}

  <footer>
    ChurnGuard SaaS &nbsp;·&nbsp; Relatório gerado automaticamente em ${report.generatedAt}
  </footer>
</body>
</html>`);

    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Relatório Completo IA
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Consolida análises de 3 agentes em paralelo: Analista de Dados, Cientista e
              Engenheiro de IA.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {report && (
              <Button size="sm" variant="outline" onClick={exportPDF} className="gap-2">
                <Printer className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            )}
            <Button
              size="sm"
              onClick={generateReport}
              disabled={loading || predictions.length === 0}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {loading ? "Gerando..." : report ? "Regenerar" : "Gerar Relatório"}
            </Button>
          </div>
        </div>

        {loading && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Consultando 3 agentes IA em paralelo...
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> Analista de Dados
              </span>
              <span className="flex items-center gap-1">
                <FlaskConical className="h-3 w-3" /> Cientista de Dados
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" /> Engenheiro de IA
              </span>
            </div>
            <Progress value={66} className="h-1 animate-pulse" />
          </div>
        )}
      </CardHeader>

      {error && (
        <CardContent className="pt-0">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}

      {report && (
        <CardContent className="pt-0 space-y-6">
          {/* ── KPI Snapshot ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total Clientes",
                value: formatNumber(totalClientes),
                icon: <Users className="h-4 w-4" />,
                color: "text-foreground",
              },
              {
                label: "Em Risco Alto",
                value: formatPercent(pctAltoRisco),
                sub: `${altosRisco} clientes`,
                icon: <AlertTriangle className="h-4 w-4" />,
                color: "text-destructive",
              },
              {
                label: "Receita em Risco",
                value: formatCurrency(receitaEmRisco),
                icon: <DollarSign className="h-4 w-4" />,
                color: "text-amber-600",
              },
              {
                label: "Clientes Críticos",
                value: String(criticos),
                icon: <Flame className="h-4 w-4" />,
                color: "text-purple-600",
              },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border bg-background p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1 text-xs">
                  {k.icon} {k.label}
                </div>
                <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
                {k.sub && <div className="text-xs text-muted-foreground">{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Section 1: Executive Summary (Agent 3) ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b border-primary/20 pb-2">
              <BarChart3 className="h-4 w-4" />
              1. Resumo Executivo — Analista de Dados
            </h3>

            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {report.analytics.resumo_executivo}
            </p>

            {report.analytics.alertas?.length > 0 && (
              <div className="space-y-1.5">
                {report.analytics.alertas.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {a}
                  </div>
                ))}
              </div>
            )}

            {report.analytics.insights?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Insights Identificados
                </p>
                <div className="space-y-2">
                  {report.analytics.insights.map((ins, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{ins.titulo}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{ins.descricao}</div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${
                          IMPACTO_COLORS[ins.impacto] ?? "bg-gray-100"
                        }`}
                      >
                        {ins.impacto}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.analytics.recomendacoes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Recomendações Estratégicas
                </p>
                <div className="space-y-2">
                  {report.analytics.recomendacoes.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium">{rec.acao}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {rec.impacto_estimado}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${
                          PRIORIDADE_COLORS[rec.prioridade] ?? "bg-gray-100"
                        }`}
                      >
                        {rec.prioridade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Model Health (Agent 4) ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b border-primary/20 pb-2">
              <FlaskConical className="h-4 w-4" />
              2. Saúde do Modelo — Cientista de Dados
            </h3>

            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Status do Modelo</span>
                <span
                  className={`text-sm font-bold px-2 py-0.5 rounded ${
                    SAUDE_CONFIG[report.science.saude_modelo]?.badgeClass ?? ""
                  }`}
                >
                  {SAUDE_CONFIG[report.science.saude_modelo]?.label ??
                    report.science.saude_modelo}
                </span>
              </div>
              <Progress value={report.science.score_saude * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Score: {Math.round(report.science.score_saude * 100)}%
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              {report.science.drift_detectado ? (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              Data drift:{" "}
              {report.science.drift_detectado
                ? `detectado — features: ${report.science.features_em_drift.join(", ")}`
                : "não detectado"}
            </div>

            <p className="text-sm leading-relaxed whitespace-pre-wrap">{report.science.analysis}</p>

            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-900">
              <span className="font-semibold">Recomendação: </span>
              {report.science.recomendacao}
            </div>
          </div>

          {/* ── Section 3: Engineering Review (Agent 5) ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b border-primary/20 pb-2">
              <Cpu className="h-4 w-4" />
              3. Revisão de Engenharia — Engenheiro de IA
            </h3>

            {report.engineering.problemas_criticos?.length > 0 && (
              <div className="space-y-1.5">
                {report.engineering.problemas_criticos.map((prob, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900"
                  >
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {prob}
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {report.engineering.analysis}
            </p>

            {report.engineering.melhorias_prioritarias?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Melhorias Prioritárias
                </p>
                <div className="space-y-2">
                  {report.engineering.melhorias_prioritarias.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{m.titulo}</span>
                      <div className="flex gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-medium ${
                            IMPACTO_COLORS[m.impacto] ?? "bg-gray-100"
                          }`}
                        >
                          impacto: {m.impacto}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          esforço: {m.esforco}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.engineering.roadmap?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Roadmap Técnico
                </p>
                <div className="space-y-2">
                  {report.engineering.roadmap.map((r, i) => (
                    <div key={i} className="rounded-md border bg-background px-3 py-2 text-sm">
                      <span className="font-semibold text-primary">v{r.versao}</span>
                      <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {r.features.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground border-t pt-3">
            Relatório gerado em {report.generatedAt} · 3 agentes IA (Groq / Llama 3.3 70B)
          </p>
        </CardContent>
      )}
    </Card>
  );
}
