import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/actions/admin-auth";
import { executors } from "@/lib/agent/executor";
import { getActiveAIProvider } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import type { ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    toolName: string;
    toolParams: Record<string, unknown>;
    conversationHistory: ChatMessage[];
  };

  const executor = executors[body.toolName];
  if (!executor) {
    return NextResponse.json({ success: false, aiSummary: `Ferramenta "${body.toolName}" não encontrada.` });
  }

  let result;
  try {
    result = await executor(body.toolParams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, aiSummary: `Erro ao executar: ${msg}` });
  }

  // Ask AI to summarize the result in natural language
  const provider = await getActiveAIProvider();
  if (!provider) {
    return NextResponse.json({ success: result.success, aiSummary: result.message });
  }

  const summaryPrompt = result.success
    ? `A ação foi executada com sucesso. Resultado técnico: "${result.message}". ${result.data ? `Dados: ${JSON.stringify(result.data).slice(0, 2000)}` : ""}\n\nResuma para o usuário em português, de forma clara e concisa. Se houver dados (lista de itens, detalhes), apresente de forma legível.`
    : `A ação falhou. Mensagem de erro: "${result.message}". Informe o usuário em português de forma direta.`;

  try {
    const aiResponse = await provider.chat(
      [...body.conversationHistory, { role: "user", content: summaryPrompt }],
      buildSystemPrompt(),
      [] // no tools in the summary step
    );
    const summary = aiResponse.type === "text" ? aiResponse.text : result.message;
    return NextResponse.json({ success: result.success, aiSummary: summary });
  } catch {
    return NextResponse.json({ success: result.success, aiSummary: result.message });
  }
}
