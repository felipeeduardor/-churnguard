"""Agente 2 — Segurança de Dados"""
from __future__ import annotations
import json

from app.agents.base_agent import run_groq_agent
from app.schemas.agent import (
    SecurityCheckRequest,
    SecurityCheckResponse,
    SecurityThreat,
    SecurityAnomaly,
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "verificar_injecao_csv",
            "description": "Verifica se o CSV contém fórmulas de injeção como =CMD, =SUM, @SUM, pipes, ou outros padrões maliciosos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ameacas_encontradas": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "tipo": {"type": "string"},
                                "campo": {"type": "string"},
                                "descricao": {"type": "string"},
                            },
                            "required": ["tipo", "campo", "descricao"],
                        },
                    },
                    "limpo": {"type": "boolean", "description": "True se nenhuma injeção foi detectada"},
                },
                "required": ["ameacas_encontradas", "limpo"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detectar_anomalias",
            "description": "Identifica outliers estatísticos extremos nas colunas numéricas (valores >10x ou <1/10x da média).",
            "parameters": {
                "type": "object",
                "properties": {
                    "anomalias": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "campo": {"type": "string"},
                                "problema": {"type": "string"},
                            },
                            "required": ["campo", "problema"],
                        },
                    }
                },
                "required": ["anomalias"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "auditar_qualidade_dados",
            "description": "Verifica integridade geral: colunas faltando, tipos incorretos, datas inválidas, clientes duplicados.",
            "parameters": {
                "type": "object",
                "properties": {
                    "problemas": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "score_qualidade": {
                        "type": "number",
                        "description": "Score de 0 a 1 indicando qualidade dos dados",
                    },
                },
                "required": ["problemas", "score_qualidade"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "emitir_relatorio_seguranca",
            "description": "Emite o relatório final de segurança com nível de risco consolidado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nivel_risco": {
                        "type": "string",
                        "enum": ["baixo", "medio", "alto", "critico"],
                        "description": "Nível de risco consolidado",
                    },
                    "justificativa": {"type": "string"},
                },
                "required": ["nivel_risco", "justificativa"],
            },
        },
    },
]


def check_security(req: SecurityCheckRequest) -> SecurityCheckResponse:
    system_prompt = (
        "Você é um especialista em segurança de dados e qualidade de dados para sistemas de ML. "
        "Analise o CSV enviado verificando ameaças de injeção, anomalias estatísticas e qualidade geral. "
        "Use todas as ferramentas disponíveis antes de escrever o relatório final. Responda em pt-BR."
    )

    stats_summary = json.dumps(req.column_stats, ensure_ascii=False)[:2000]
    sample_summary = json.dumps(req.sample_data[:10], ensure_ascii=False)[:1500] if req.sample_data else "[]"

    user_message = (
        f"Arquivo: {req.filename} | Upload ID: {req.upload_id} | Total de linhas: {req.total_rows}\n\n"
        f"Estatísticas das colunas: {stats_summary}\n\n"
        f"Amostra (10 primeiras linhas): {sample_summary}\n\n"
        "Realize: 1) verificar_injecao_csv, 2) detectar_anomalias, "
        "3) auditar_qualidade_dados, 4) emitir_relatorio_seguranca. "
        "Depois escreva um resumo executivo de segurança."
    )

    final_text, tool_calls_log = run_groq_agent(system_prompt, user_message, TOOLS)

    ameacas: list[SecurityThreat] = []
    anomalias: list[SecurityAnomaly] = []
    nivel_risco = "baixo"
    acoes_tomadas: list[str] = []

    for tc in tool_calls_log:
        name = tc["name"]
        args = tc["args"]

        if name == "verificar_injecao_csv":
            for t in args.get("ameacas_encontradas", []):
                ameacas.append(SecurityThreat(**t))
            acoes_tomadas.append(
                f"verificar_injecao_csv: {'limpo' if args.get('limpo') else f'{len(ameacas)} ameaças'}"
            )

        elif name == "detectar_anomalias":
            for a in args.get("anomalias", []):
                anomalias.append(SecurityAnomaly(**a))
            acoes_tomadas.append(f"detectar_anomalias: {len(anomalias)} anomalias")

        elif name == "auditar_qualidade_dados":
            score = args.get("score_qualidade", 1.0)
            problemas = args.get("problemas", [])
            acoes_tomadas.append(
                f"auditar_qualidade_dados: score={score:.2f}, {len(problemas)} problemas"
            )

        elif name == "emitir_relatorio_seguranca":
            nivel_risco = args.get("nivel_risco", "baixo")
            acoes_tomadas.append(f"emitir_relatorio_seguranca: nivel={nivel_risco}")

    return SecurityCheckResponse(
        nivel_risco=nivel_risco,
        analysis=final_text,
        ameacas=ameacas,
        anomalias=anomalias,
        acoes_tomadas=acoes_tomadas,
    )
