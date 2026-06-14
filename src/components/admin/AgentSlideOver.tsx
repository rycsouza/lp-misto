"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, X, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMessage {
  type: "text";
  role: "user" | "assistant";
  content: string;
}

interface ActionMessage {
  type: "action";
  role: "assistant";
  toolName: string;
  displayName: string;
  toolParams: Record<string, unknown>;
  preText?: string;
  confirmationLevel: "auto" | "preview" | "danger";
  confirmationLabel: string;
  status: "pending" | "executing" | "success" | "error" | "cancelled";
  resultText?: string;
}

type Message = TextMessage | ActionMessage;

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] px-3.5 py-2.5 bg-primary text-primary-foreground rounded-2xl rounded-br-sm text-sm leading-relaxed">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3.5 py-2.5 bg-secondary text-foreground rounded-2xl rounded-bl-sm text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function ActionCard({
  msg,
  onConfirm,
  onCancel,
}: {
  msg: ActionMessage;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = msg.confirmationLevel === "danger";

  return (
    <div className="flex justify-start">
      <div className={`max-w-[90%] w-full rounded-xl border text-sm overflow-hidden ${isDanger ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
        {msg.preText && (
          <p className="px-3.5 pt-3 pb-0 text-foreground leading-relaxed">{msg.preText}</p>
        )}
        <div className="px-3.5 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            {isDanger ? (
              <AlertTriangle size={13} className="text-destructive shrink-0" />
            ) : (
              <Bot size={13} className="text-primary shrink-0" />
            )}
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDanger ? "text-destructive" : "text-primary"}`}>
              {msg.displayName}
            </span>
          </div>
          <p className="text-foreground text-sm">{msg.confirmationLabel}</p>
        </div>

        {msg.status === "pending" && (
          <div className={`flex gap-2 px-3.5 pb-3 pt-0`}>
            <button
              onClick={onConfirm}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-opacity ${isDanger ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"}`}
            >
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}

        {msg.status === "executing" && (
          <div className="flex items-center gap-2 px-3.5 pb-3 text-muted-foreground text-xs">
            <Loader2 size={12} className="animate-spin" /> Executando…
          </div>
        )}

        {msg.status === "success" && (
          <div className="flex items-center gap-2 px-3.5 pb-3 text-green-500 text-xs">
            <CheckCircle2 size={12} /> Concluído
          </div>
        )}

        {msg.status === "error" && (
          <div className="flex items-center gap-2 px-3.5 pb-3 text-destructive text-xs">
            <XCircle size={12} /> Falhou
          </div>
        )}

        {msg.status === "cancelled" && (
          <div className="flex items-center gap-2 px-3.5 pb-3 text-muted-foreground text-xs">
            <X size={12} /> Cancelado
          </div>
        )}

        {msg.resultText && (
          <div className="px-3.5 pb-3 text-xs text-muted-foreground border-t border-border pt-2 mt-0">
            {msg.resultText}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentSlideOver() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const getTextHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter((m): m is TextMessage => m.type === "text")
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { type: "text", role: "user", content: text }]);

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: getTextHistory(), newMessage: text }),
      });
      const data = await res.json() as {
        type: string;
        text?: string;
        toolName?: string;
        toolParams?: Record<string, unknown>;
        preText?: string;
        confirmationLevel?: "auto" | "preview" | "danger";
        confirmationLabel?: string;
        displayName?: string;
      };

      if (data.type === "text") {
        setMessages((prev) => [...prev, { type: "text", role: "assistant", content: data.text! }]);
      } else if (data.type === "tool_call") {
        const actionMsg: ActionMessage = {
          type: "action",
          role: "assistant",
          toolName: data.toolName!,
          displayName: data.displayName!,
          toolParams: data.toolParams!,
          preText: data.preText,
          confirmationLevel: data.confirmationLevel!,
          confirmationLabel: data.confirmationLabel!,
          status: "pending",
        };

        if (data.confirmationLevel === "auto") {
          // execute immediately
          setMessages((prev) => [...prev, { ...actionMsg, status: "executing" }]);
          await executeAction(actionMsg);
        } else {
          setMessages((prev) => [...prev, actionMsg]);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { type: "text", role: "assistant", content: "Erro ao conectar com o assistente. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(actionMsg: ActionMessage) {
    // Update action to executing
    setMessages((prev) =>
      prev.map((m) =>
        m === actionMsg || (m.type === "action" && m.toolName === actionMsg.toolName && m.status === "pending")
          ? { ...m, status: "executing" }
          : m
      )
    );

    try {
      const res = await fetch("/api/admin/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: actionMsg.toolName,
          toolParams: actionMsg.toolParams,
          conversationHistory: getTextHistory(),
        }),
      });
      const data = await res.json() as { success: boolean; aiSummary: string };

      setMessages((prev) =>
        prev.map((m) =>
          m.type === "action" && m.toolName === actionMsg.toolName && (m.status === "executing" || m.status === "pending")
            ? { ...m, status: data.success ? "success" : "error" }
            : m
        )
      );

      setMessages((prev) => [...prev, { type: "text", role: "assistant", content: data.aiSummary }]);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.type === "action" && m.toolName === actionMsg.toolName && m.status === "executing"
            ? { ...m, status: "error", resultText: "Erro ao executar." }
            : m
        )
      );
    }
  }

  function confirmAction(actionMsg: ActionMessage) {
    executeAction(actionMsg);
  }

  function cancelAction(actionMsg: ActionMessage) {
    setMessages((prev) =>
      prev.map((m) =>
        m === actionMsg ? { ...m, status: "cancelled" } : m
      )
    );
    setMessages((prev) => [...prev, { type: "text", role: "assistant", content: "Tudo bem, ação cancelada." }]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasPendingAction = messages.some((m) => m.type === "action" && m.status === "pending");

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
        title="Assistente IA"
      >
        <Bot size={20} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
              <Bot size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Assistente Admin</p>
              <p className="text-xs text-muted-foreground">Misto EC</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Limpar conversa"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Bot size={22} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Como posso ajudar?</p>
                <p className="text-xs text-muted-foreground">Experimente:</p>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                {[
                  "Crie um cupom de 10% OFF geral, limite 1 por cliente",
                  "Liste os pedidos pendentes de hoje",
                  "Quanto custa o ingresso inteira?",
                  "Quais ofertas de upsell estão ativas?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left text-xs px-3 py-2 bg-secondary rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.type === "text" && msg.role === "user") return <UserBubble key={i} content={msg.content} />;
            if (msg.type === "text" && msg.role === "assistant") return <AssistantBubble key={i} content={msg.content} />;
            if (msg.type === "action") {
              return (
                <ActionCard
                  key={i}
                  msg={msg}
                  onConfirm={() => confirmAction(msg)}
                  onCancel={() => cancelAction(msg)}
                />
              );
            }
            return null;
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 bg-secondary rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-3 border-t border-border shrink-0">
          {hasPendingAction && (
            <p className="text-xs text-amber-500 mb-2 text-center">Confirme ou cancele a ação acima antes de continuar.</p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || hasPendingAction}
              placeholder={hasPendingAction ? "Aguardando confirmação…" : "Digite um comando…"}
              rows={1}
              className="flex-1 px-3 py-2.5 bg-input border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-h-32"
              style={{ minHeight: "42px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || hasPendingAction}
              className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      </div>
    </>
  );
}
