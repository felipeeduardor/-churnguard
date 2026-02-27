"""Agente 1 — Analista de Churn"""
from __future__ import annotations
import json
from datetime import datetime, timedelta

from app.agents.base_agent import run_groq_agent
from app.schemas.agent import (
    ChurnAnalysisRequest,
    ChurnAnalysisResponse,
    ActionPlan,
    DataFix,
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "identificar_causa_churn",
            "description": "Analisa os valores SHAP do cliente e identifica a causa principal e causas secundárias do risco de churn.",
            "parameters": {
                "type": "object",
                "properties": {
                    "causa_principal": {"type": "string", "description": "Feature com maior impacto SHAP positivo (aumenta risco)"},
                    "causas_secundarias": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Outras features relevantes",
                    },
                    "narrativa": {"type": "string", "description": "Explicação em linguagem de negócio em pt-BR"},
                },
                "required": ["causa_principal", "causas_secundarias", "narrativa"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gerar_planos_acao",
            "description": "Gera entre 2 e 5 planos de ação concretos para reter o cliente em risco de churn.",
            "parameters": {
                "type": "object",
                "properties": {
                    "planos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "descricao": {"type": "string"},
                                "responsavel": {"type": "string"},
                                "prazo_dias": {"type": "integer"},
                            },
                            "required": ["descricao", "responsavel", "prazo_dias"],
                        },
                    }
                },
                "required": ["planos"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "corrigir_dados",
            "description": "Detecta e sugere correções para valores negativos, outliers extremos ou dados suspeitos nas métricas do cliente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "problemas": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "campo": {"type": "string"},
                                "problema": {"type": "string"},
                                "correcao": {"type": "string"},
                            },
                            "required": ["campo", "problema", "correcao"],
                        },
                    }
                },
                "required": ["problemas"],
            },
        },
    },
]


def analyze_churn(req: ChurnAnalysisRequest) -> ChurnAnalysisResponse:
    system_prompt = (
        "Você é um especialista em retenção de clientes B2B com foco em análise de churn. "
        "Analise os dados do cliente, use as ferramentas disponíveis para identificar causas "
        "e gerar planos de ação práticos. Responda sempre em português do Brasil. "
        "Seja objetivo, direto e orientado a negócios."
    )

    shap_summary = ", ".join(
        f"{k}: {v:.3f}" for k, v in sorted(req.shap_values.items(), key=lambda x: abs(x[1]), reverse=True)
    )
    metrics_summary = ", ".join(f"{k}: {v}" for k, v in req.metrics.items())

    user_message = (
        f"Cliente #{req.codcli} tem {req.churn_probability:.0%} de probabilidade de churn "
        f"(segmento: {req.segmento}).\n\n"
        f"Valores SHAP (impacto no score): {shap_summary}\n"
        f"Métricas: {metrics_summary}\n\n"
        "Use as ferramentas: 1) identificar_causa_churn, 2) gerar_planos_acao, "
        "3) corrigir_dados se necessário. Depois escreva um resumo narrativo completo."
    )

    final_text, tool_calls_log = run_groq_agent(system_prompt, user_message, TOOLS)

    # Extract structured data from tool call args
    action_plans: list[ActionPlan] = []
    data_fixes: list[DataFix] = []
    actions_taken: list[str] = []

    today = datetime.now()
    for tc in tool_calls_log:
        name = tc["name"]
        args = tc["args"]

        if name == "gerar_planos_acao":
            for p in args.get("planos", []):
                prazo = (today + timedelta(days=p.get("prazo_dias", 30))).strftime("%Y-%m-%d")
                action_plans.append(
                    ActionPlan(
                        descricao=p.get("descricao", ""),
                        responsavel=p.get("responsavel", "Equipe Comercial"),
                        prazo=prazo,
                        status="pendente",
                    )
                )
            actions_taken.append(f"gerar_planos_acao: {len(action_plans)} planos gerados")

        elif name == "identificar_causa_churn":
            causa = args.get("causa_principal", "")
            actions_taken.append(f"identificar_causa_churn: {causa}")

        elif name == "corrigir_dados":
            for fix in args.get("problemas", []):
                data_fixes.append(
                    DataFix(
                        campo=fix.get("campo", ""),
                        problema=fix.get("problema", ""),
                        correcao=fix.get("correcao", ""),
                    )
                )
            if data_fixes:
                actions_taken.append(f"corrigir_dados: {len(data_fixes)} problemas detectados")

    return ChurnAnalysisResponse(
        analysis=final_text,
        action_plans=action_plans,
        data_fixes=data_fixes,
        actions_taken=actions_taken,
    )
