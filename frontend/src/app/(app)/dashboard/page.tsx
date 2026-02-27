import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Header } from "@/components/layout/Header";
import { KPICard } from "@/components/dashboard/KPICard";
import { ChurnDistributionChart } from "@/components/dashboard/ChurnDistributionChart";
import { RiskByRegionChart } from "@/components/dashboard/RiskByRegionChart";
import { RiskSegmentTable } from "@/components/dashboard/RiskSegmentTable";
import { DataAnalystPanel } from "./DataAnalystPanel";
import { Users, AlertTriangle, DollarSign, Flame } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Prediction } from "@/types";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get org_id from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  const orgId = profile?.org_id;

  let predictions: Prediction[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("org_id", orgId)
      .order("probabilidade_churn", { ascending: false });
    predictions = data ?? [];
  }

  // KPI calculations
  const totalClientes = predictions.length;
  const altosRisco = predictions.filter((p) => p.probabilidade_churn > 0.6).length;
  const pctAltoRisco = totalClientes > 0 ? altosRisco / totalClientes : 0;
  const receitaEmRisco = predictions
    .filter((p) => p.probabilidade_churn > 0.6)
    .reduce((sum, p) => sum + p.vl_nota_sum, 0);
  const criticos = predictions.filter((p) => p.segmento === "critico").length;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle="Visão geral de risco de churn da sua base de clientes"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {totalClientes === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhuma predição encontrada</h2>
            <p className="text-muted-foreground max-w-sm">
              Faça o upload de um CSV na aba{" "}
              <a href="/upload" className="text-primary hover:underline">
                Upload CSV
              </a>{" "}
              para começar a monitorar o churn dos seus clientes.
            </p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KPICard
                title="Total de Clientes"
                value={totalClientes.toLocaleString("pt-BR")}
                icon={<Users className="h-4 w-4" />}
              />
              <KPICard
                title="Em Risco Alto"
                value={formatPercent(pctAltoRisco)}
                delta={`${altosRisco} clientes`}
                deltaPositive={false}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <KPICard
                title="Receita em Risco"
                value={formatCurrency(receitaEmRisco)}
                icon={<DollarSign className="h-4 w-4" />}
              />
              <KPICard
                title="Clientes Críticos"
                value={criticos}
                icon={<Flame className="h-4 w-4" />}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChurnDistributionChart predictions={predictions} />
              <RiskByRegionChart predictions={predictions} />
            </div>

            {/* Top Critical Table */}
            <RiskSegmentTable predictions={predictions} />

            {/* AI Data Analyst */}
            <DataAnalystPanel predictions={predictions} orgId={orgId ?? ""} />
          </>
        )}
      </div>
    </div>
  );
}
