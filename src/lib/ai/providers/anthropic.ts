import type { AIProviderClient, ChatMessage, AgentTool, AIResponse } from "../types";

export class AnthropicProvider implements AIProviderClient {
  constructor(private apiKey: string, private model: string) {}

  async chat(messages: ChatMessage[], systemPrompt: string, tools: AgentTool[]): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
      body.tool_choice = { type: "auto" };
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    type Block = { type: string; text?: string; name?: string; input?: unknown };
    const data = (await res.json()) as { content: Block[] };

    const toolBlock = data.content.find((b) => b.type === "tool_use");
    if (toolBlock) {
      const textBlock = data.content.find((b) => b.type === "text");
      return {
        type: "tool_call",
        toolName: toolBlock.name!,
        toolParams: toolBlock.input as Record<string, unknown>,
        preText: textBlock?.text || undefined,
      };
    }

    const textBlock = data.content.find((b) => b.type === "text");
    return { type: "text", text: textBlock?.text ?? "" };
  }
}
