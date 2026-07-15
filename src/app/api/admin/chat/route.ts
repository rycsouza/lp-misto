import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/actions/admin-auth";
import { getActiveAIProvider } from "@/lib/ai";
import { getToolsForAI, getToolDefinition } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { executors } from "@/lib/agent/executor";
import type { ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUTO_ITERATIONS = 5;

export async function POST(request: Request) {
  // O assistente executa ferramentas que abrangem TODOS os módulos (mutações e
  // leituras sensíveis) — é feature adminOnly. Exigimos papel admin no endpoint
  // (backstop além das guardas por-action), não só sessão autenticada.
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    messages: ChatMessage[];
    newMessage: string;
    currentPage?: string;
  };

  const provider = await getActiveAIProvider();
  if (!provider) {
    return NextResponse.json(
      { type: "text", text: "Nenhum provedor de IA configurado. Configure em Configurações → Assistente IA." },
      { status: 200 }
    );
  }

  const { getSiteConfig } = await import("@/lib/config");
  const systemPrompt = buildSystemPrompt(body.currentPage, (await getSiteConfig()).siteName);

  const history: ChatMessage[] = [
    ...body.messages,
    { role: "user", content: body.newMessage },
  ];

  let response = await provider.chat(history, systemPrompt, getToolsForAI());
  let iterations = 0;

  // Auto-execute "auto" level tools in sequence until we get text or a confirmation-required tool
  while (response.type === "tool_call" && iterations < MAX_AUTO_ITERATIONS) {
    const definition = getToolDefinition(response.toolName);

    // Non-auto tools go back to the client for confirmation
    if (!definition || definition.confirmationLevel !== "auto") {
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

    // Auto-execute
    const executor = executors[response.toolName];
    if (!executor) {
      history.push({ role: "assistant", content: `Ferramenta ${response.toolName} não disponível.` });
      break;
    }

    const result = await executor(response.toolParams);

    // Feed result back into history so the AI can continue reasoning
    history.push({
      role: "assistant",
      content: response.preText
        ? `${response.preText} [executei: ${response.toolName}]`
        : `[executei: ${response.toolName}]`,
    });
    history.push({
      role: "user",
      content: `[resultado da ferramenta ${response.toolName}]: ${result.success ? "sucesso" : "erro"} — ${result.message}${result.data ? `\nDados: ${JSON.stringify(result.data).slice(0, 4000)}` : ""}`,
    });

    response = await provider.chat(history, systemPrompt, getToolsForAI());
    iterations++;
  }

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
