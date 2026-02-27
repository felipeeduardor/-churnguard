import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Header } from "@/components/layout/Header";
import { ClienteTable } from "@/components/clientes/ClienteTable";
import { Users } from "lucide-react";
import type { Prediction } from "@/types";

export default async function ClientesPage() {
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
      .order("probabilidade_churn", { ascending: false });
    predictions = data ?? [];
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Clientes"
        subtitle={`${predictions.length} clientes na sua base`}
      />
      <div className="flex-1 p-6 overflow-auto">
        {predictions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhum cliente encontrado</h2>
            <p className="text-muted-foreground">
              Faça o upload de um CSV para ver os clientes aqui.
            </p>
          </div>
        ) : (
          <ClienteTable predictions={predictions} />
        )}
      </div>
    </div>
  );
}
