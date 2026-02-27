from fastapi import APIRouter, HTTPException
import logging

from app.schemas.agent import (
    ChurnAnalysisRequest, ChurnAnalysisResponse,
    SecurityCheckRequest, SecurityCheckResponse,
    AnalyticsInsightsRequest, AnalyticsInsightsResponse,
    ScienceEvaluateRequest, ScienceEvaluateResponse,
    EngineeringReviewRequest, EngineeringReviewResponse,
)
from app.agents import (
    churn_agent,
    security_agent,
    data_analyst_agent,
    data_scientist_agent,
    ai_engineer_agent,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["agents"])


@router.post("/churn/analyze", response_model=ChurnAnalysisResponse)
async def churn_analyze(req: ChurnAnalysisRequest):
    """Agente 1 — Analista de Churn: analisa SHAP e gera planos de ação para um cliente."""
    try:
        return churn_agent.analyze_churn(req)
    except Exception as exc:
        logger.exception("churn_agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/security/check", response_model=SecurityCheckResponse)
async def security_check(req: SecurityCheckRequest):
    """Agente 2 — Segurança: verifica injeção, anomalias e qualidade do CSV enviado."""
    try:
        return security_agent.check_security(req)
    except Exception as exc:
        logger.exception("security_agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/analytics/insights", response_model=AnalyticsInsightsResponse)
async def analytics_insights(req: AnalyticsInsightsRequest):
    """Agente 3 — Analista de Dados: gera insights de negócio sobre a base de clientes."""
    try:
        return data_analyst_agent.generate_insights(req)
    except Exception as exc:
        logger.exception("data_analyst_agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/science/evaluate", response_model=ScienceEvaluateResponse)
async def science_evaluate(req: ScienceEvaluateRequest):
    """Agente 4 — Cientista de Dados: avalia saúde do modelo e detecta data drift."""
    try:
        return data_scientist_agent.evaluate_model(req)
    except Exception as exc:
        logger.exception("data_scientist_agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/engineering/review", response_model=EngineeringReviewResponse)
async def engineering_review(req: EngineeringReviewRequest):
    """Agente 5 — Engenheiro de IA: revisa pipeline e sugere melhorias técnicas."""
    try:
        return ai_engineer_agent.review_engineering(req)
    except Exception as exc:
        logger.exception("ai_engineer_agent error")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
