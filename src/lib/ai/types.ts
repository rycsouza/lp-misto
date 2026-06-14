export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCallResponse {
  type: "tool_call";
  toolName: string;
  toolParams: Record<string, unknown>;
  preText?: string;
}

export interface TextResponse {
  type: "text";
  text: string;
}

export type AIResponse = ToolCallResponse | TextResponse;

export interface AIProviderClient {
  chat(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: AgentTool[]
  ): Promise<AIResponse>;
}
