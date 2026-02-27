import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Header } from "@/components/layout/Header";
import { ShapChart } from "@/components/clientes/ShapChart";
import { RiskBadge } from "@/components/clientes/RiskBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionPlanSection } from "./ActionPlanSection";
import { ClientWrapper } from "./ClientWrapper";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { MapPin, ShoppingCart, DollarSign, Clock } from "lucide-react";
import type { Prediction } from "@/types";

interface Props {
  params: { id: string };
}

export default async function ClienteDetailPage({ params }: Props) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  const orgId = profile?.org_id;
  if (!orgId) notFound();

  const { data: prediction } = await supabase
    .from("predictions")
    .select("*")
    .eq("org_id", orgId)
    .eq("codcli", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!prediction) notFound();

  const p: Prediction = prediction;

  // Gauge color
  const gaugeColor =
    p.probabilidade_churn > 0.8
      ? "#7c3aed"
      : p.probabilidade_churn > 0.6
      ? "#ef4444"
      : p.probabilidade_churn > 0.4
      ? "#f59e0b"
      : p.probabilidade_churn > 0.2
      ? "#84cc16"
      : "#22c55e";

  const pct = Math.round(p.probabilidade_churn * 100);

  return (
    <div className="flex flex-col h-full">
      <Header
        title={`Cliente #${p.codcli}`}
        subtitle={`Análise individual de risco de churn`}
      />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Top row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Risk Gauge */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Probabilidade de Churn</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="64" fill="none" stroke="#f0f0f0" strokeWidth="16" />
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="none"
                    stroke={gaugeColor}
                    strokeWidth="16"
                    strokeDasharray={`${(pct / 100) * 401.92} 401.92`}
                    strokeDashoffset="100.48"
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-3xl font-bold" style={{ color: gaugeColor }}>
                    {pct}%
                  </div>
                  <div className="text-xs text-muted-foreground">churn</div>
                </div>
              </div>
              <RiskBadge segmento={p.segmento} className="text-sm px-4 py-1" />
            </CardContent>
          </Card>

          {/* Client data */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Região</p>
                    <p className="font-medium">{p.regiao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Frequência de Compras</p>
                    <p className="font-medium">{p.frequencia_compras}x</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Receita Total</p>
                    <p className="font-medium">{formatCurrency(p.vl_nota_sum)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                    <p className="font-medium">{formatCurrency(p.ticket_medio)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recência</p>
                    <p className="font-medium">{Math.round(p.recencia_dias)} dias</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SHAP Chart */}
        {p.shap_values && Object.keys(p.shap_values).length > 0 && (
          <ShapChart shapValues={p.shap_values} />
        )}

        {/* Agent Panel */}
        <ClientWrapper prediction={p} orgId={orgId} />

        {/* Action Plans */}
        <ActionPlanSection predictionId={p.id!} orgId={orgId} />
      </div>
    </div>
  );
}
