import type { AIProviderClient, ChatMessage, AgentTool, AIResponse } from "../types";

export class OpenAIProvider implements AIProviderClient {
  constructor(private apiKey: string, private model: string) {}

  async chat(messages: ChatMessage[], systemPrompt: string, tools: AgentTool[]): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    };

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    type Choice = {
      message: {
        content?: string | null;
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    };
    const data = (await res.json()) as { choices: Choice[] };
    const choice = data.choices[0];

    if (choice.message.tool_calls?.[0]) {
      const tc = choice.message.tool_calls[0];
      return {
        type: "tool_call",
        toolName: tc.function.name,
        toolParams: JSON.parse(tc.function.arguments),
        preText: choice.message.content || undefined,
      };
    }

    return { type: "text", text: choice.message.content ?? "" };
  }
}
