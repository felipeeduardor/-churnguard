import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Header } from "@/components/layout/Header";
import { RelatoriosClient } from "./RelatoriosClient";
import type { Prediction } from "@/types";

export default async function RelatoriosPage() {
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
  let predictions: Prediction[] = [];

  if (orgId) {
    const { data } = await supabase
      .from("predictions")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    predictions = data ?? [];
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Relatórios" subtitle="Análise histórica e exportação de dados" />
      <div className="flex-1 p-6 overflow-auto">
        <RelatoriosClient predictions={predictions} orgId={orgId ?? ""} />
      </div>
    </div>
  );
}
