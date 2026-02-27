import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Header } from "@/components/layout/Header";
import { UploadPageClient } from "./UploadPageClient";

export default async function UploadPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user!.id)
    .single();

  const orgId = profile?.org_id ?? "";

  // Get upload history
  const { data: uploads } = await supabase
    .from("uploads")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Upload de Dados"
        subtitle="Faça upload do CSV de clientes para gerar predições de churn"
      />
      <div className="flex-1 p-6 overflow-auto">
        <UploadPageClient orgId={orgId} uploads={uploads ?? []} />
      </div>
    </div>
  );
}
