"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { evaluateScience, reviewEngineering } from "@/lib/api";
import type {
  ScienceEvaluateResponse,
  EngineeringReviewResponse,
  Prediction,
} from "@/types";
import {
  Bot,
  Loader2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface Props {
  predictions: Prediction[];
}

type ActiveTab = "scientist" | "engineer";

const SAUDE_CONFIG = {
  saudavel: { label: "Saudável", color: "text-green-600", bg: "bg-green-500" },
  atencao: { label: "Atenção", color: "text-yellow-600", bg: "bg-yellow-500" },
  retreinar: { label: "Retreinar", color: "text-red-600", bg: "bg-red-500" },
};

export function ScienceEngineerPanel({ predictions }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scientist");

  // Scientist state
  const [sciLoading, setSciLoading] = useState(false);
  const [sciResult, setSciResult] = useState<ScienceEvaluateResponse | null>(null);
  const [sciError, setSciError] = useState<string | null>(null);
  const [sciExpanded, setSciExpanded] = useState(true);

  // Engineer state
  const [engLoading, setEngLoading] = useState(false);
  const [engResult, setEngResult] = useState<EngineeringReviewResponse | null>(null);
  const [engError, setEngError] = useState<string | null>(null);
  const [engExpanded, setEngExpanded] = useState(true);

  async function handleScience() {
    setSciLoading(true);
    setSciError(null);
    try {
      // Compute distribution of probabilities
      const dist: Record<string, number> = {
        "0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0,
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

      // Average SHAP values
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

      const res = await evaluateScience({
        total_predicoes: predictions.length,
        distribuicao_probabilidades: dist,
        shap_medias: shapMedias,
      }) as ScienceEvaluateResponse;
      setSciResult(res);
    } catch (e: unknown) {
      setSciError(e instanceof Error ? e.message : "Erro no agente cientista");
    } finally {
      setSciLoading(false);
    }
  }

  async function handleEngineering() {
    setEngLoading(true);
    setEngError(null);
    try {
      const res = await reviewEngineering({
        volume_dados: {
          total_clientes: predictions.length,
        },
        pipeline_steps: ["aggregation", "scaling", "prediction", "shap"],
      }) as EngineeringReviewResponse;
      setEngResult(res);
    } catch (e: unknown) {
      setEngError(e instanceof Error ? e.message : "Erro no agente engenheiro");
    } finally {
      setEngLoading(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Agentes IA — ML Lab
        </CardTitle>
        {/* Tabs */}
        <div className="flex gap-1 mt-2 border rounded-md p-1 bg-background w-fit">
          <button
            onClick={() => setActiveTab("scientist")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === "scientist"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Cientista de Dados
          </button>
          <button
            onClick={() => setActiveTab("engineer")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === "engineer"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            Engenheiro de IA
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* ─── Scientist Tab ─── */}
        {activeTab === "scientist" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Avalia a saúde do modelo ML e detecta data drift.
              </p>
              <div className="flex items-center gap-2">
                {sciResult && (
                  <button
                    onClick={() => setSciExpanded((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {sciExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
                <Button size="sm" onClick={handleScience} disabled={sciLoading} className="gap-2">
                  {sciLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FlaskConical className="h-3.5 w-3.5" />
                  )}
                  {sciLoading ? "Avaliando..." : "Avaliar Modelo"}
                </Button>
              </div>
            </div>

            {sciError && <p className="text-sm text-destructive">{sciError}</p>}

            {sciResult && sciExpanded && (
              <div className="space-y-4">
                {/* Health Score */}
                <div className="rounded-md border bg-background p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Saúde do Modelo</span>
                    <span
                      className={`text-sm font-bold ${SAUDE_CONFIG[sciResult.saude_modelo]?.color ?? "text-foreground"}`}
                    >
                      {SAUDE_CONFIG[sciResult.saude_modelo]?.label ?? sciResult.saude_modelo}
                    </span>
                  </div>
                  <Progress
                    value={sciResult.score_saude * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Score: {Math.round(sciResult.score_saude * 100)}%
                  </p>
                </div>

                {/* Drift */}
                <div className="flex items-center gap-2 text-sm">
                  {sciResult.drift_detectado ? (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <span>
                    Data drift:{" "}
                    {sciResult.drift_detectado
                      ? `detectado (${sciResult.features_em_drift.join(", ")})`
                      : "não detectado"}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Análise
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{sciResult.analysis}</p>
                </div>

                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-900">
                  <span className="font-semibold">Recomendação: </span>
                  {sciResult.recomendacao}
                </div>

                {sciResult.acoes_tomadas?.length > 0 && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Ferramentas: {sciResult.acoes_tomadas.join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Engineer Tab ─── */}
        {activeTab === "engineer" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Revisa o pipeline de ML e sugere melhorias técnicas.
              </p>
              <div className="flex items-center gap-2">
                {engResult && (
                  <button
                    onClick={() => setEngExpanded((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {engExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
                <Button size="sm" onClick={handleEngineering} disabled={engLoading} className="gap-2">
                  {engLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5" />
                  )}
                  {engLoading ? "Revisando..." : "Revisar Pipeline"}
                </Button>
              </div>
            </div>

            {engError && <p className="text-sm text-destructive">{engError}</p>}

            {engResult && engExpanded && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Análise Técnica
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{engResult.analysis}</p>
                </div>

                {/* Critical problems */}
                {engResult.problemas_criticos?.length > 0 && (
                  <div className="space-y-1">
                    {engResult.problemas_criticos.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900"
                      >
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {p}
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {engResult.melhorias_prioritarias?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Melhorias Prioritárias ({engResult.melhorias_prioritarias.length})
                    </p>
                    <div className="space-y-2">
                      {engResult.melhorias_prioritarias.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{m.titulo}</span>
                          <div className="flex gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
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

                {/* Roadmap */}
                {engResult.roadmap?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Roadmap
                    </p>
                    <div className="space-y-2">
                      {engResult.roadmap.map((r, i) => (
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

                {engResult.acoes_tomadas?.length > 0 && (
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    Ferramentas: {engResult.acoes_tomadas.join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
