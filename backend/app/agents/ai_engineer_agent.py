"""Agente 5 — Engenheiro de IA"""
from __future__ import annotations
import json

from app.agents.base_agent import run_groq_agent
from app.schemas.agent import (
    EngineeringReviewRequest,
    EngineeringReviewResponse,
    Melhoria,
    RoadmapItem,
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "revisar_arquitetura_pipeline",
            "description": "Avalia a eficiência e robustez do pipeline de ML (aggregation → scaling → prediction → shap).",
            "parameters": {
                "type": "object",
                "properties": {
                    "pontos_fortes": {"type": "array", "items": {"type": "string"}},
                    "pontos_fracos": {"type": "array", "items": {"type": "string"}},
                    "avaliacao": {"type": "string"},
                },
                "required": ["pontos_fortes", "pontos_fracos", "avaliacao"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "identificar_gargalos_performance",
            "description": "Analisa as etapas do pipeline e identifica onde há maior latência ou custo computacional.",
            "parameters": {
                "type": "object",
                "properties": {
                    "gargalos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "etapa": {"type": "string"},
                                "problema": {"type": "string"},
                                "solucao": {"type": "string"},
                            },
                            "required": ["etapa", "problema", "solucao"],
                        },
                    }
                },
                "required": ["gargalos"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "sugerir_melhorias_modelo",
            "description": "Sugere melhorias de hiperparâmetros, novas features ou algoritmos alternativos ao LightGBM.",
            "parameters": {
                "type": "object",
                "properties": {
                    "melhorias": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "titulo": {"type": "string"},
                                "impacto": {"type": "string", "enum": ["alto", "medio", "baixo"]},
                                "esforco": {"type": "string", "enum": ["alto", "medio", "baixo"]},
                            },
                            "required": ["titulo", "impacto", "esforco"],
                        },
                    }
                },
                "required": ["melhorias"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "planejar_proxima_versao",
            "description": "Cria um roadmap técnico com versões e features prioritárias.",
            "parameters": {
                "type": "object",
                "properties": {
                    "roadmap": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "versao": {"type": "string"},
                                "features": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["versao", "features"],
                        },
                    }
                },
                "required": ["roadmap"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verificar_boas_praticas",
            "description": "Checa conformidade com MLOps best practices: versionamento, monitoramento, CI/CD, documentação.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conformidades": {"type": "array", "items": {"type": "string"}},
                    "nao_conformidades": {"type": "array", "items": {"type": "string"}},
                    "score_mlops": {"type": "number", "description": "0 a 1"},
                },
                "required": ["conformidades", "nao_conformidades", "score_mlops"],
            },
        },
    },
]


def review_engineering(req: EngineeringReviewRequest) -> EngineeringReviewResponse:
    system_prompt = (
        "Você é um engenheiro de IA sênior com foco em MLOps e sistemas de ML em produção. "
        "Revise a infraestrutura do pipeline de churn prediction e sugira melhorias técnicas prioritárias. "
        "Use todas as ferramentas disponíveis e escreva uma análise técnica completa em pt-BR."
    )

    user_message = (
        f"Modelo: {req.modelo_info.algoritmo} | "
        f"{req.modelo_info.n_features} features | "
        f"{req.modelo_info.n_estimators} estimadores\n"
        f"Performance: {req.modelo_info.tempo_predicao_ms}ms por predição | "
        f"Tamanho: {req.modelo_info.tamanho_modelo_kb}KB\n"
        f"Volume: {req.volume_dados.total_clientes} clientes, "
        f"{req.volume_dados.total_transacoes} transações\n"
        f"Pipeline: {' → '.join(req.pipeline_steps)}\n"
        f"Erros recentes: {req.erros_recentes or 'nenhum'}\n\n"
        "Execute: 1) revisar_arquitetura_pipeline, 2) identificar_gargalos_performance, "
        "3) sugerir_melhorias_modelo, 4) planejar_proxima_versao, "
        "5) verificar_boas_praticas. Depois escreva análise técnica completa."
    )

    final_text, tool_calls_log = run_groq_agent(system_prompt, user_message, TOOLS)

    melhorias: list[Melhoria] = []
    problemas_criticos: list[str] = []
    roadmap: list[RoadmapItem] = []
    acoes_tomadas: list[str] = []

    for tc in tool_calls_log:
        name = tc["name"]
        args = tc["args"]

        if name == "sugerir_melhorias_modelo":
            for m in args.get("melhorias", []):
                melhorias.append(Melhoria(**m))
            acoes_tomadas.append(f"sugerir_melhorias_modelo: {len(melhorias)} melhorias")

        elif name == "planejar_proxima_versao":
            for r in args.get("roadmap", []):
                roadmap.append(RoadmapItem(**r))
            acoes_tomadas.append(f"planejar_proxima_versao: {len(roadmap)} versões")

        elif name == "identificar_gargalos_performance":
            for g in args.get("gargalos", []):
                # High-impact gargalos become critical problems
                if "lento" in g.get("problema", "").lower() or "erro" in g.get("problema", "").lower():
                    problemas_criticos.append(
                        f"{g.get('etapa', '')}: {g.get('problema', '')}"
                    )
            acoes_tomadas.append(
                f"identificar_gargalos_performance: {len(args.get('gargalos', []))} gargalos"
            )

        elif name == "revisar_arquitetura_pipeline":
            acoes_tomadas.append("revisar_arquitetura_pipeline: concluído")

        elif name == "verificar_boas_praticas":
            score = args.get("score_mlops", 0)
            nao = args.get("nao_conformidades", [])
            acoes_tomadas.append(
                f"verificar_boas_praticas: score={score:.2f}, {len(nao)} não-conformidades"
            )

    return EngineeringReviewResponse(
        analysis=final_text,
        melhorias_prioritarias=melhorias,
        problemas_criticos=problemas_criticos,
        roadmap=roadmap,
        acoes_tomadas=acoes_tomadas,
    )
