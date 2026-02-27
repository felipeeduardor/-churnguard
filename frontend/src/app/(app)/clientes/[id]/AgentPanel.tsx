"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeChurn } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type { Prediction, ChurnAnalysisResponse, AgentActionPlan } from "@/types";
import { Bot, Loader2, ChevronDown, ChevronUp, Save } from "lucide-react";

interface Props {
  prediction: Prediction;
  orgId: string;
}

export function AgentPanel({ prediction: p, orgId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChurnAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const res = await analyzeChurn({
        codcli: p.codcli,
        churn_probability: p.probabilidade_churn,
        segmento: p.segmento,
        shap_values: p.shap_values ?? {},
        metrics: {
          vl_nota_sum: p.vl_nota_sum,
          recencia_dias: p.recencia_dias,
          frequencia_compras: p.frequencia_compras,
          ticket_medio: p.ticket_medio,
          regiao: p.regiao,
        },
      }) as ChurnAnalysisResponse;
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao chamar agente");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlans() {
    if (!result?.action_plans?.length || !p.id) return;
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const rows = result.action_plans.map((plan: AgentActionPlan) => ({
        prediction_id: p.id,
        org_id: orgId,
        descricao: plan.descricao,
        responsavel: plan.responsavel,
        prazo: plan.prazo,
        status: "pendente",
      }));
      await supabase.from("action_plans").insert(rows);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar planos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agente IA — Analista de Churn
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
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
              {loading ? "Analisando..." : "Analisar com IA"}
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
          {/* Narrative */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Análise
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.analysis}</p>
          </div>

          {/* Action Plans */}
          {result.action_plans?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Planos de Ação ({result.action_plans.length})
              </p>
              <div className="space-y-2">
                {result.action_plans.map((plan, i) => (
                  <div key={i} className="rounded-md border bg-background p-3 text-sm">
                    <p className="font-medium">{plan.descricao}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>Responsável: {plan.responsavel}</span>
                      <span>Prazo: {new Date(plan.prazo).toLocaleDateString("pt-BR")}</span>
                      <Badge variant="outline" className="text-xs py-0">
                        {plan.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  variant={saved ? "outline" : "default"}
                  onClick={handleSavePlans}
                  disabled={saving || saved}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saved ? "Planos salvos!" : "Salvar todos os planos"}
                </Button>
              </div>
            </div>
          )}

          {/* Data Fixes */}
          {result.data_fixes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Problemas nos Dados ({result.data_fixes.length})
              </p>
              <div className="space-y-1">
                {result.data_fixes.map((fix, i) => (
                  <div key={i} className="rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs">
                    <span className="font-mono font-medium">{fix.campo}</span>:{" "}
                    {fix.problema} → <span className="text-green-700">{fix.correcao}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions taken */}
          {result.actions_taken?.length > 0 && (
            <div className="pt-1 border-t">
              <p className="text-xs text-muted-foreground">
                Ferramentas usadas: {result.actions_taken.join(" · ")}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
