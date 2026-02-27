"""Agente 3 — Analista de Dados"""
from __future__ import annotations
import json

from app.agents.base_agent import run_groq_agent
from app.schemas.agent import (
    AnalyticsInsightsRequest,
    AnalyticsInsightsResponse,
    Insight,
    Recomendacao,
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analisar_distribuicao_risco",
            "description": "Interpreta a distribuição de clientes por segmento de risco e identifica desequilíbrios críticos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "segmento_critico": {"type": "string", "description": "Segmento mais preocupante"},
                    "percentual_critico": {"type": "number"},
                    "observacao": {"type": "string"},
                },
                "required": ["segmento_critico", "percentual_critico", "observacao"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "comparar_regioes",
            "description": "Identifica regiões com maior risco de churn e possíveis causas regionais.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regiao_mais_critica": {"type": "string"},
                    "score_risco": {"type": "number"},
                    "analise": {"type": "string"},
                },
                "required": ["regiao_mais_critica", "score_risco", "analise"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "identificar_padroes",
            "description": "Identifica padrões correlacionados entre métricas e churn (ex: alta recência + baixo ticket).",
            "parameters": {
                "type": "object",
                "properties": {
                    "padroes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "titulo": {"type": "string"},
                                "descricao": {"type": "string"},
                                "impacto": {"type": "string", "enum": ["alto", "medio", "baixo"]},
                            },
                            "required": ["titulo", "descricao", "impacto"],
                        },
                    }
                },
                "required": ["padroes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gerar_recomendacoes_negocio",
            "description": "Gera recomendações estratégicas concretas para reduzir o churn geral da base.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recomendacoes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "acao": {"type": "string"},
                                "prioridade": {"type": "string", "enum": ["alta", "media", "baixa"]},
                                "impacto_estimado": {"type": "string"},
                            },
                            "required": ["acao", "prioridade", "impacto_estimado"],
                        },
                    }
                },
                "required": ["recomendacoes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gerar_resumo_executivo",
            "description": "Cria um resumo executivo em linguagem de negócio para apresentação à gestão.",
            "parameters": {
                "type": "object",
                "properties": {
                    "resumo": {"type": "string", "description": "Parágrafo de 3-5 frases para C-level"},
                    "alertas_principais": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["resumo", "alertas_principais"],
            },
        },
    },
]


def generate_insights(req: AnalyticsInsightsRequest) -> AnalyticsInsightsResponse:
    system_prompt = (
        "Você é um analista de dados sênior especializado em análise de churn B2B. "
        "Gere insights acionáveis e um resumo executivo com base nos dados fornecidos. "
        "Use todas as ferramentas disponíveis antes de escrever o resumo final. Responda em pt-BR."
    )

    top_str = json.dumps(
        [t.model_dump() for t in req.top_clientes_risco[:5]], ensure_ascii=False
    )

    user_message = (
        f"Base de clientes: {req.total_clientes} clientes\n"
        f"Distribuição por segmento: {json.dumps(req.distribuicao_segmentos, ensure_ascii=False)}\n"
        f"Risco por região: {json.dumps(req.risco_por_regiao, ensure_ascii=False)}\n"
        f"Receita em risco (churn > 60%): R$ {req.receita_em_risco:,.0f}\n"
        f"Recência média: {req.media_recencia_dias:.0f} dias\n"
        f"Top 5 clientes em risco: {top_str}\n\n"
        "Execute: 1) analisar_distribuicao_risco, 2) comparar_regioes, "
        "3) identificar_padroes, 4) gerar_recomendacoes_negocio, "
        "5) gerar_resumo_executivo. Depois escreva a análise completa."
    )

    final_text, tool_calls_log = run_groq_agent(system_prompt, user_message, TOOLS)

    insights: list[Insight] = []
    recomendacoes: list[Recomendacao] = []
    alertas: list[str] = []
    resumo_executivo = ""
    acoes_tomadas: list[str] = []

    for tc in tool_calls_log:
        name = tc["name"]
        args = tc["args"]

        if name == "identificar_padroes":
            for p in args.get("padroes", []):
                insights.append(Insight(**p))
            acoes_tomadas.append(f"identificar_padroes: {len(insights)} padrões")

        elif name == "gerar_recomendacoes_negocio":
            for r in args.get("recomendacoes", []):
                recomendacoes.append(Recomendacao(**r))
            acoes_tomadas.append(f"gerar_recomendacoes_negocio: {len(recomendacoes)} recomendações")

        elif name == "gerar_resumo_executivo":
            resumo_executivo = args.get("resumo", "")
            alertas = args.get("alertas_principais", [])
            acoes_tomadas.append("gerar_resumo_executivo: concluído")

        elif name == "comparar_regioes":
            regiao = args.get("regiao_mais_critica", "")
            score = args.get("score_risco", 0)
            alertas.append(f"Região {regiao} com score de risco {score:.0%}")
            acoes_tomadas.append(f"comparar_regioes: {regiao}")

        elif name == "analisar_distribuicao_risco":
            acoes_tomadas.append(
                f"analisar_distribuicao_risco: segmento_critico={args.get('segmento_critico', '')}"
            )

    if not resumo_executivo:
        resumo_executivo = final_text

    return AnalyticsInsightsResponse(
        resumo_executivo=resumo_executivo,
        insights=insights,
        recomendacoes=recomendacoes,
        alertas=alertas,
        acoes_tomadas=acoes_tomadas,
    )
