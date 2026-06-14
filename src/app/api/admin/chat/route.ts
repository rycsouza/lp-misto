import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/actions/admin-auth";
import { getActiveAIProvider } from "@/lib/ai";
import { getToolsForAI, getToolDefinition } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import type { ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    messages: ChatMessage[];
    newMessage: string;
  };

  const provider = await getActiveAIProvider();
  if (!provider) {
    return NextResponse.json(
      { type: "text", text: "Nenhum provedor de IA configurado. Configure em Configurações → Assistente IA." },
      { status: 200 }
    );
  }

  const history: ChatMessage[] = [
    ...body.messages,
    { role: "user", content: body.newMessage },
  ];

  const response = await provider.chat(history, buildSystemPrompt(), getToolsForAI());

  if (response.type === "tool_call") {
    const definition = getToolDefinition(response.toolName);
    return NextResponse.json({
      type: "tool_call",
      toolName: response.toolName,
      toolParams: response.toolParams,
      preText: response.preText,
      confirmationLevel: definition?.confirmationLevel ?? "preview",
      confirmationLabel: definition?.formatConfirmation(response.toolParams) ?? response.toolName,
      displayName: definition?.displayName ?? response.toolName,
    });
  }

  return NextResponse.json({ type: "text", text: response.text });
}
