export type Segmento = "sem_risco" | "baixo" | "medio" | "alto" | "critico";

export interface Prediction {
  id?: string;
  upload_id?: string;
  org_id?: string;
  codcli: number;
  probabilidade_churn: number;
  segmento: Segmento;
  vl_nota_sum: number;
  frequencia_compras: number;
  ticket_medio: number;
  recencia_dias: number;
  regiao: string;
  shap_values: Record<string, number>;
  created_at?: string;
}

export interface Upload {
  id: string;
  org_id: string;
  filename: string;
  status: "processing" | "done" | "error";
  total_clientes: number;
  created_at: string;
}

export interface ActionPlan {
  id: string;
  prediction_id: string;
  org_id: string;
  descricao: string;
  status: "pendente" | "em_andamento" | "concluido";
  responsavel: string;
  prazo: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  name: string;
  role: "admin" | "member";
}

export interface KPI {
  title: string;
  value: string | number;
  delta?: string;
  icon?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

// ─── Agent Types ────────────────────────────────────────────────

export interface AgentActionPlan {
  descricao: string;
  responsavel: string;
  prazo: string;
  status: string;
}

export interface AgentDataFix {
  campo: string;
  problema: string;
  correcao: string;
}

export interface ChurnAnalysisResponse {
  analysis: string;
  action_plans: AgentActionPlan[];
  data_fixes: AgentDataFix[];
  actions_taken: string[];
}

export interface SecurityThreat {
  tipo: string;
  campo: string;
  descricao: string;
}

export interface SecurityAnomaly {
  campo: string;
  problema: string;
}

export interface SecurityCheckResponse {
  nivel_risco: "baixo" | "medio" | "alto" | "critico";
  analysis: string;
  ameacas: SecurityThreat[];
  anomalias: SecurityAnomaly[];
  acoes_tomadas: string[];
}

export interface AgentInsight {
  titulo: string;
  descricao: string;
  impacto: "alto" | "medio" | "baixo";
}

export interface AgentRecomendacao {
  acao: string;
  prioridade: "alta" | "media" | "baixa";
  impacto_estimado: string;
}

export interface AnalyticsInsightsResponse {
  resumo_executivo: string;
  insights: AgentInsight[];
  recomendacoes: AgentRecomendacao[];
  alertas: string[];
  acoes_tomadas: string[];
}

export interface ScienceEvaluateResponse {
  saude_modelo: "saudavel" | "atencao" | "retreinar";
  score_saude: number;
  analysis: string;
  drift_detectado: boolean;
  features_em_drift: string[];
  recomendacao: string;
  acoes_tomadas: string[];
}

export interface AgentMelhoria {
  titulo: string;
  impacto: string;
  esforco: string;
}

export interface AgentRoadmapItem {
  versao: string;
  features: string[];
}

export interface EngineeringReviewResponse {
  analysis: string;
  melhorias_prioritarias: AgentMelhoria[];
  problemas_criticos: string[];
  roadmap: AgentRoadmapItem[];
  acoes_tomadas: string[];
}
