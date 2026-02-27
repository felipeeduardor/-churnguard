const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function predictCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/predict/csv`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Prediction failed");
  }

  return res.json();
}

export async function predictSingle(data: {
  codcli: number;
  vl_nota: number;
  meses_sem_compra: number;
  regiao: string;
  custo_medio: number;
  qtd_prd_nota: number;
}) {
  const res = await fetch(`${API_URL}/predict/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Prediction failed");
  }

  return res.json();
}

export async function getModelFeatures() {
  const res = await fetch(`${API_URL}/model/features`);
  if (!res.ok) throw new Error("Failed to fetch features");
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_URL}/health`);
  return res.ok;
}

// ─── Agent API functions ─────────────────────────────────────────

async function postAgent<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? `Agent request failed: ${path}`);
  }
  return res.json();
}

export async function analyzeChurn(data: {
  codcli: number;
  churn_probability: number;
  segmento: string;
  shap_values: Record<string, number>;
  metrics: Record<string, unknown>;
}) {
  return postAgent("/agent/churn/analyze", data);
}

export async function checkSecurity(data: {
  upload_id: string;
  filename: string;
  total_rows: number;
  sample_data: Record<string, unknown>[];
  column_stats: Record<string, unknown>;
}) {
  return postAgent("/agent/security/check", data);
}

export async function getAnalyticsInsights(data: {
  org_id: string;
  total_clientes: number;
  distribuicao_segmentos: Record<string, number>;
  risco_por_regiao: Record<string, number>;
  receita_em_risco: number;
  media_recencia_dias: number;
  top_clientes_risco: { codcli: number; prob: number; receita: number }[];
}) {
  return postAgent("/agent/analytics/insights", data);
}

export async function evaluateScience(data: {
  modelo_versao?: string;
  data_treino?: string;
  total_predicoes?: number;
  distribuicao_probabilidades?: Record<string, number>;
  shap_medias?: Record<string, number>;
  feature_stats_novo?: Record<string, { mean: number; std: number }>;
  feature_stats_treino?: Record<string, { mean: number; std: number }>;
}) {
  return postAgent("/agent/science/evaluate", data);
}

export async function reviewEngineering(data: {
  modelo_info?: {
    algoritmo?: string;
    n_features?: number;
    n_estimators?: number;
    tempo_predicao_ms?: number;
    tamanho_modelo_kb?: number;
  };
  volume_dados?: { total_clientes?: number; total_transacoes?: number };
  pipeline_steps?: string[];
  erros_recentes?: string[];
}) {
  return postAgent("/agent/engineering/review", data);
}
