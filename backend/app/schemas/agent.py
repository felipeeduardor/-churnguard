from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Agent 1 — Churn Analyst
# ─────────────────────────────────────────────

class ChurnAnalysisRequest(BaseModel):
    codcli: int
    churn_probability: float
    segmento: str
    shap_values: dict[str, float] = Field(default_factory=dict)
    metrics: dict[str, Any] = Field(default_factory=dict)


class ActionPlan(BaseModel):
    descricao: str
    responsavel: str
    prazo: str
    status: str = "pendente"


class DataFix(BaseModel):
    campo: str
    problema: str
    correcao: str


class ChurnAnalysisResponse(BaseModel):
    analysis: str
    action_plans: list[ActionPlan] = Field(default_factory=list)
    data_fixes: list[DataFix] = Field(default_factory=list)
    actions_taken: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Agent 2 — Security
# ─────────────────────────────────────────────

class SecurityCheckRequest(BaseModel):
    upload_id: str
    filename: str
    total_rows: int
    sample_data: list[dict[str, Any]] = Field(default_factory=list)
    column_stats: dict[str, Any] = Field(default_factory=dict)


class SecurityThreat(BaseModel):
    tipo: str
    campo: str
    descricao: str


class SecurityAnomaly(BaseModel):
    campo: str
    problema: str


class SecurityCheckResponse(BaseModel):
    nivel_risco: str  # baixo | medio | alto | critico
    analysis: str
    ameacas: list[SecurityThreat] = Field(default_factory=list)
    anomalias: list[SecurityAnomaly] = Field(default_factory=list)
    acoes_tomadas: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Agent 3 — Data Analyst
# ─────────────────────────────────────────────

class TopClienteRisco(BaseModel):
    codcli: int
    prob: float
    receita: float


class AnalyticsInsightsRequest(BaseModel):
    org_id: str
    total_clientes: int
    distribuicao_segmentos: dict[str, int] = Field(default_factory=dict)
    risco_por_regiao: dict[str, float] = Field(default_factory=dict)
    receita_em_risco: float = 0.0
    media_recencia_dias: float = 0.0
    top_clientes_risco: list[TopClienteRisco] = Field(default_factory=list)


class Insight(BaseModel):
    titulo: str
    descricao: str
    impacto: str  # alto | medio | baixo


class Recomendacao(BaseModel):
    acao: str
    prioridade: str
    impacto_estimado: str


class AnalyticsInsightsResponse(BaseModel):
    resumo_executivo: str
    insights: list[Insight] = Field(default_factory=list)
    recomendacoes: list[Recomendacao] = Field(default_factory=list)
    alertas: list[str] = Field(default_factory=list)
    acoes_tomadas: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Agent 4 — Data Scientist
# ─────────────────────────────────────────────

class FeatureStats(BaseModel):
    mean: float
    std: float


class ScienceEvaluateRequest(BaseModel):
    modelo_versao: str = "1.0"
    data_treino: str = "2024-01-01"
    total_predicoes: int = 0
    distribuicao_probabilidades: dict[str, float] = Field(default_factory=dict)
    shap_medias: dict[str, float] = Field(default_factory=dict)
    feature_stats_novo: dict[str, FeatureStats] = Field(default_factory=dict)
    feature_stats_treino: dict[str, FeatureStats] = Field(default_factory=dict)


class ScienceEvaluateResponse(BaseModel):
    saude_modelo: str  # saudavel | atencao | retreinar
    score_saude: float
    analysis: str
    drift_detectado: bool = False
    features_em_drift: list[str] = Field(default_factory=list)
    recomendacao: str
    acoes_tomadas: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────
# Agent 5 — AI Engineer
# ─────────────────────────────────────────────

class ModelInfo(BaseModel):
    algoritmo: str = "LightGBM"
    n_features: int = 11
    n_estimators: int = 100
    tempo_predicao_ms: float = 250
    tamanho_modelo_kb: float = 450


class VolumedeDados(BaseModel):
    total_clientes: int = 0
    total_transacoes: int = 0


class EngineeringReviewRequest(BaseModel):
    modelo_info: ModelInfo = Field(default_factory=ModelInfo)
    volume_dados: VolumedeDados = Field(default_factory=VolumedeDados)
    pipeline_steps: list[str] = Field(default_factory=list)
    erros_recentes: list[str] = Field(default_factory=list)


class Melhoria(BaseModel):
    titulo: str
    impacto: str
    esforco: str


class RoadmapItem(BaseModel):
    versao: str
    features: list[str]


class EngineeringReviewResponse(BaseModel):
    analysis: str
    melhorias_prioritarias: list[Melhoria] = Field(default_factory=list)
    problemas_criticos: list[str] = Field(default_factory=list)
    roadmap: list[RoadmapItem] = Field(default_factory=list)
    acoes_tomadas: list[str] = Field(default_factory=list)
