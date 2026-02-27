"""Agente 4 — Cientista de Dados"""
from __future__ import annotations
import json

from app.agents.base_agent import run_groq_agent
from app.schemas.agent import (
    ScienceEvaluateRequest,
    ScienceEvaluateResponse,
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "avaliar_distribuicao_predicoes",
            "description": "Detecta se a distribuição de probabilidades de churn está deslocada em relação ao esperado (model drift).",
            "parameters": {
                "type": "object",
                "properties": {
                    "drift_detectado": {"type": "boolean"},
                    "descricao": {"type": "string"},
                    "score_desvio": {"type": "number", "description": "0=sem drift, 1=drift total"},
                },
                "required": ["drift_detectado", "descricao", "score_desvio"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calcular_psi",
            "description": "Calcula o Population Stability Index (PSI) para cada feature comparando dados novos vs treino.",
            "parameters": {
                "type": "object",
                "properties": {
                    "psi_por_feature": {
                        "type": "object",
                        "additionalProperties": {"type": "number"},
                        "description": "PSI de cada feature. PSI > 0.2 indica drift significativo.",
                    },
                    "features_em_drift": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["psi_por_feature", "features_em_drift"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analisar_shap_drift",
            "description": "Compara os valores SHAP médios atuais com os esperados do treino para detectar mudança de importância.",
            "parameters": {
                "type": "object",
                "properties": {
                    "features_alteradas": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "analise": {"type": "string"},
                },
                "required": ["features_alteradas", "analise"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "avaliar_qualidade_predicoes",
            "description": "Identifica padrões suspeitos como muitos scores iguais, distribuição uniforme ou degenerada.",
            "parameters": {
                "type": "object",
                "properties": {
                    "suspeitos": {"type": "boolean"},
                    "descricao": {"type": "string"},
                },
                "required": ["suspeitos", "descricao"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recomendar_acao",
            "description": "Com base nas análises anteriores, recomenda manter, ajustar ou retreinar o modelo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "saude_modelo": {
                        "type": "string",
                        "enum": ["saudavel", "atencao", "retreinar"],
                    },
                    "score_saude": {
                        "type": "number",
                        "description": "Score entre 0 e 1",
                    },
                    "recomendacao": {"type": "string"},
                },
                "required": ["saude_modelo", "score_saude", "recomendacao"],
            },
        },
    },
]


def evaluate_model(req: ScienceEvaluateRequest) -> ScienceEvaluateResponse:
    system_prompt = (
        "Você é um cientista de dados sênior especializado em MLOps e monitoramento de modelos de ML. "
        "Avalie a saúde do modelo de churn e detecte possível data drift. "
        "Use todas as ferramentas disponíveis e depois escreva uma análise técnica detalhada em pt-BR."
    )

    new_stats = json.dumps(
        {k: v.model_dump() for k, v in req.feature_stats_novo.items()}, ensure_ascii=False
    )
    train_stats = json.dumps(
        {k: v.model_dump() for k, v in req.feature_stats_treino.items()}, ensure_ascii=False
    )

    user_message = (
        f"Modelo v{req.modelo_versao} (treinado em {req.data_treino})\n"
        f"Total de predições produção: {req.total_predicoes}\n"
        f"Distribuição de probabilidades: {json.dumps(req.distribuicao_probabilidades)}\n"
        f"SHAP médios atuais: {json.dumps(req.shap_medias)}\n"
        f"Stats features (produção): {new_stats}\n"
        f"Stats features (treino): {train_stats}\n\n"
        "Execute: 1) avaliar_distribuicao_predicoes, 2) calcular_psi, "
        "3) analisar_shap_drift, 4) avaliar_qualidade_predicoes, "
        "5) recomendar_acao. Depois escreva análise técnica completa."
    )

    final_text, tool_calls_log = run_groq_agent(system_prompt, user_message, TOOLS)

    saude_modelo = "saudavel"
    score_saude = 1.0
    recomendacao = "Modelo estável."
    drift_detectado = False
    features_em_drift: list[str] = []
    acoes_tomadas: list[str] = []

    for tc in tool_calls_log:
        name = tc["name"]
        args = tc["args"]

        if name == "avaliar_distribuicao_predicoes":
            if args.get("drift_detectado"):
                drift_detectado = True
            acoes_tomadas.append(
                f"avaliar_distribuicao_predicoes: drift={'sim' if drift_detectado else 'não'}"
            )

        elif name == "calcular_psi":
            features_em_drift = args.get("features_em_drift", [])
            acoes_tomadas.append(
                f"calcular_psi: {len(features_em_drift)} features em drift"
            )

        elif name == "analisar_shap_drift":
            alteradas = args.get("features_alteradas", [])
            if alteradas:
                features_em_drift = list(set(features_em_drift + alteradas))
            acoes_tomadas.append(f"analisar_shap_drift: {len(alteradas)} features alteradas")

        elif name == "avaliar_qualidade_predicoes":
            acoes_tomadas.append(
                f"avaliar_qualidade_predicoes: suspeito={'sim' if args.get('suspeitos') else 'não'}"
            )

        elif name == "recomendar_acao":
            saude_modelo = args.get("saude_modelo", "saudavel")
            score_saude = args.get("score_saude", 1.0)
            recomendacao = args.get("recomendacao", "")
            acoes_tomadas.append(f"recomendar_acao: {saude_modelo}")

    return ScienceEvaluateResponse(
        saude_modelo=saude_modelo,
        score_saude=score_saude,
        analysis=final_text,
        drift_detectado=drift_detectado,
        features_em_drift=features_em_drift,
        recomendacao=recomendacao,
        acoes_tomadas=acoes_tomadas,
    )
