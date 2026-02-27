"use client";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { predictCsv } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";
import type { Prediction } from "@/types";

interface Props {
  orgId: string;
  onComplete: (predictions: Prediction[]) => void;
}

type Status = "idle" | "ready" | "uploading" | "saving" | "done" | "error";

const REQUIRED_COLUMNS = ["codcli", "vl_nota", "regiao"];

export function CsvUploader({ orgId, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string[][]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setStatus("ready");
    setErrorMsg("");

    // Preview first 5 rows
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text
        .split("\n")
        .slice(0, 6)
        .map((row) => row.split(",").map((c) => c.trim()));
      setPreview(rows);
    };
    reader.readAsText(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  async function handlePredict() {
    if (!file) return;
    setStatus("uploading");
    setProgress(20);

    try {
      const response = await predictCsv(file);
      setProgress(60);
      setStatus("saving");

      const supabase = getSupabaseClient();

      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from("uploads")
        .insert({
          org_id: orgId,
          filename: file.name,
          status: "processing",
          total_clientes: response.total,
        })
        .select()
        .single();

      if (uploadError) throw new Error(uploadError.message);

      // Batch insert predictions
      const predictions: Prediction[] = response.predictions.map((p: Prediction) => ({
        ...p,
        upload_id: upload.id,
        org_id: orgId,
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < predictions.length; i += BATCH_SIZE) {
        const batch = predictions.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("predictions").insert(batch);
        if (error) throw new Error(error.message);
        setProgress(60 + Math.round(((i + BATCH_SIZE) / predictions.length) * 35));
      }

      // Mark upload as done
      await supabase
        .from("uploads")
        .update({ status: "done" })
        .eq("id", upload.id);

      setProgress(100);
      setStatus("done");
      onComplete(predictions);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
    }
  }

  function reset() {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setErrorMsg("");
    setPreview([]);
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          (status === "uploading" || status === "saving") && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-primary" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Arraste e solte seu CSV aqui</p>
            <p className="text-sm text-muted-foreground">
              ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Colunas obrigatórias: {REQUIRED_COLUMNS.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <p className="px-4 py-2 text-xs font-medium text-muted-foreground border-b">
            Preview (primeiras 5 linhas)
          </p>
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                {preview[0]?.map((col, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(1).map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 text-muted-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Progress */}
      {(status === "uploading" || status === "saving") && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status === "uploading" ? "Processando predições..." : "Salvando resultados..."}
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Success */}
      {status === "done" && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Predições concluídas com sucesso!
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {status === "ready" && (
          <Button onClick={handlePredict} className="gap-2">
            <Upload className="h-4 w-4" />
            Rodar Predição
          </Button>
        )}
        {(status === "ready" || status === "done" || status === "error") && (
          <Button variant="outline" onClick={reset}>
            <X className="h-4 w-4 mr-2" />
            {status === "done" ? "Novo Upload" : "Cancelar"}
          </Button>
        )}
      </div>
    </div>
  );
}
