"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CsvUploader } from "@/components/upload/CsvUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { SecurityAgentPanel } from "./SecurityAgentPanel";
import type { Upload, Prediction } from "@/types";

interface Props {
  orgId: string;
  uploads: Upload[];
}

const STATUS_CONFIG = {
  processing: { label: "Processando", icon: Clock, variant: "warning" as const },
  done: { label: "Concluído", icon: CheckCircle2, variant: "success" as const },
  error: { label: "Erro", icon: AlertCircle, variant: "danger" as const },
};

export function UploadPageClient({ orgId, uploads: initialUploads }: Props) {
  const router = useRouter();
  const [uploads, setUploads] = useState(initialUploads);
  const [lastUpload, setLastUpload] = useState<Upload | null>(null);
  const [lastPredictions, setLastPredictions] = useState<Prediction[]>([]);

  function handleComplete(predictions: Prediction[]) {
    setLastPredictions(predictions);
    // Build a synthetic Upload object from the predictions result for the security agent
    if (predictions.length > 0 && predictions[0].upload_id) {
      setLastUpload({
        id: predictions[0].upload_id!,
        org_id: orgId,
        filename: "upload.csv",
        status: "done",
        total_clientes: predictions.length,
        created_at: new Date().toISOString(),
      });
    }
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Uploader */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <CsvUploader orgId={orgId} onComplete={handleComplete} />
          {lastUpload && (
            <SecurityAgentPanel upload={lastUpload} sampleData={lastPredictions} />
          )}
        </CardContent>
      </Card>

      {/* CSV Format Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formato do CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            O arquivo CSV deve conter as seguintes colunas:
          </p>
          <div className="rounded-md bg-muted px-4 py-3 font-mono text-xs overflow-x-auto">
            codcli, Id_produto, dt_nota_fiscal, vl_nota, meses_sem_compra, ultimacompra, dias_na_empresa, regiao, ano, mes, valor_base, custo_medio, qtd_prd_nota
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O campo <code className="font-mono bg-muted px-1 rounded">regiao</code> deve conter: NORTE, NORDESTE, SUDESTE, SUL, EXTERIOR ou CENTRO_OESTE
          </p>
        </CardContent>
      </Card>

      {/* History */}
      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Uploads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arquivo</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Clientes</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => {
                  const config = STATUS_CONFIG[u.status] ?? STATUS_CONFIG.processing;
                  const Icon = config.icon;
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                        {u.filename}
                      </td>
                      <td className="px-4 py-3 text-right">{u.total_clientes?.toLocaleString("pt-BR") ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
