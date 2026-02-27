from pydantic import BaseModel
from typing import Optional


class ClienteInput(BaseModel):
    codcli: int
    vl_nota: float
    meses_sem_compra: float
    regiao: str
    custo_medio: float
    qtd_prd_nota: float


class PredictionResult(BaseModel):
    codcli: int
    probabilidade_churn: float
    segmento: str
    vl_nota_sum: float
    frequencia_compras: int
    ticket_medio: float
    recencia_dias: float
    regiao: str
    shap_values: dict[str, float]


class PredictionResponse(BaseModel):
    total: int
    predictions: list[PredictionResult]


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class FeaturesResponse(BaseModel):
    features: list[FeatureImportance]
