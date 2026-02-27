"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkSecurity } from "@/lib/api";
import type { SecurityCheckResponse, Upload, Prediction } from "@/types";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  upload: Upload;
  sampleData: Prediction[];
}

const RISCO_CONFIG = {
  baixo: {
    label: "Seguro",
    icon: ShieldCheck,
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    cardClass: "border-green-200 bg-green-50/50",
  },
  medio: {
    label: "Atenção",
    icon: ShieldAlert,
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    cardClass: "border-yellow-200 bg-yellow-50/50",
  },
  alto: {
    label: "Risco Alto",
    icon: ShieldAlert,
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    cardClass: "border-orange-200 bg-orange-50/50",
  },
  critico: {
    label: "Crítico",
    icon: ShieldX,
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    cardClass: "border-red-200 bg-red-50/50",
  },
};

export function SecurityAgentPanel({ upload, sampleData }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SecurityCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        // Build column_stats from sample data
        const columnStats: Record<string, { min: number; max: number; nulls: number }> = {};
        const numericKeys = ["vl_nota_sum", "recencia_dias", "frequencia_compras", "ticket_medio"];
        for (const key of numericKeys) {
          const vals = sampleData
            .map((d) => (d as Record<string, unknown>)[key] as number)
            .filter((v) => typeof v === "number" && !isNaN(v));
          if (vals.length > 0) {
            columnStats[key] = {
              min: Math.min(...vals),
              max: Math.max(...vals),
              nulls: sampleData.length - vals.length,
            };
          }
        }

        const res = await checkSecurity({
          upload_id: upload.id,
          filename: upload.filename,
          total_rows: upload.total_clientes,
          sample_data: sampleData.slice(0, 50) as unknown as Record<string, unknown>[],
          column_stats: columnStats,
        }) as SecurityCheckResponse;

        setResult(res);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro no agente de segurança");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [upload.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = result ? (RISCO_CONFIG[result.nivel_risco] ?? RISCO_CONFIG.baixo) : null;

  return (
    <Card className={`mt-4 ${config?.cardClass ?? "border-primary/20 bg-primary/5"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Agente de Segurança
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
          {result && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config?.badgeClass}`}
              >
                {config && <config.icon className="h-3 w-3" />}
                {config?.label}
              </span>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading && (
          <p className="text-sm text-muted-foreground">Verificando segurança do arquivo...</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && !expanded && (
          <p className="text-sm text-muted-foreground line-clamp-2">{result.analysis}</p>
        )}

        {result && expanded && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.analysis}</p>

            {result.ameacas?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Ameaças detectadas ({result.ameacas.length})
                </p>
                <div className="space-y-1">
                  {result.ameacas.map((t, i) => (
                    <div key={i} className="rounded bg-red-50 border border-red-200 px-3 py-1.5 text-xs">
                      <span className="font-semibold">[{t.tipo}]</span> {t.campo}: {t.descricao}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.anomalias?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Anomalias estatísticas ({result.anomalias.length})
                </p>
                <div className="space-y-1">
                  {result.anomalias.map((a, i) => (
                    <div key={i} className="rounded bg-yellow-50 border border-yellow-200 px-3 py-1.5 text-xs">
                      <span className="font-mono font-medium">{a.campo}</span>: {a.problema}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
