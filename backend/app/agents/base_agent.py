import os
import json
import logging
from groq import Groq

logger = logging.getLogger(__name__)


def run_groq_agent(
    system_prompt: str,
    user_message: str,
    tools: list,
    max_iterations: int = 10,
) -> tuple[str, list[dict]]:
    """
    Shared agentic loop using Groq. Returns (final_text, tool_calls_log).
    """
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]
    tool_calls_log: list[dict] = []

    for iteration in range(max_iterations):
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=4096,
        )
        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        # Build assistant message dict
        assistant_msg: dict = {"role": "assistant", "content": message.content or ""}
        if message.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in message.tool_calls
            ]
        messages.append(assistant_msg)

        if finish_reason == "tool_calls":
            for tc in message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                tool_calls_log.append({"name": tc.function.name, "args": args})
                logger.info("Tool called: %s | args: %s", tc.function.name, args)
                # Return a stub result — real agents derive meaning from LLM reasoning
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(
                            {"status": "ok", "tool": tc.function.name, "args": args}
                        ),
                    }
                )
        elif finish_reason == "stop":
            return message.content or "", tool_calls_log
        else:
            logger.warning("Unexpected finish_reason=%s at iteration %d", finish_reason, iteration)
            break

    # Fallback: return last assistant content
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("content"):
            return msg["content"], tool_calls_log
    return "", tool_calls_log
