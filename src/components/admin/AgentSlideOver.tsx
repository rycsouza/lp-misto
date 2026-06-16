"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bot, X, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, RotateCcw, Paperclip, ImageIcon } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMessage {
  type: "text";
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
}

interface TypingMessage {
  type: "typing";
  role: "assistant";
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

type Message = TextMessage | TypingMessage | ActionMessage;

const SESSION_KEY = "agent_chat_history";

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserBubble({ content, imageUrls }: { content: string; imageUrls?: string[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] flex flex-col gap-1.5 items-end">
        {imageUrls && imageUrls.length > 0 && (
          <div className={`flex gap-1.5 flex-wrap justify-end ${imageUrls.length > 1 ? "max-w-full" : ""}`}>
            {imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`imagem ${i + 1}`}
                className="rounded-xl object-cover border border-primary/20"
                style={{ maxHeight: imageUrls.length > 1 ? "120px" : "192px", maxWidth: imageUrls.length > 1 ? "120px" : "100%" }}
              />
            ))}
          </div>
        )}
        {content && (
          <div className="px-3.5 py-2.5 bg-primary text-primary-foreground rounded-2xl rounded-br-sm text-sm leading-relaxed">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string, key?: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return (
    <span key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 bg-background/60 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 font-medium">
              {link[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    // Heading ## / ###
    if (/^#{2,3} /.test(line)) {
      const content = line.replace(/^#{2,3} /, "");
      nodes.push(
        <p key={i} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mt-2 mb-0.5">
          {renderInline(content)}
        </p>
      );
      i++; continue;
    }

    // Bullet list — collect consecutive items
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="flex flex-col gap-1 my-0.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 items-start">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary/70 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list — collect consecutive items
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="flex flex-col gap-1 my-0.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 items-start">
              <span className="text-xs font-bold text-primary shrink-0 mt-0.5 min-w-[14px]">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular line
    nodes.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="flex flex-col gap-1">{nodes}</div>;
}

function AssistantBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3.5 py-2.5 bg-secondary text-foreground rounded-2xl rounded-bl-sm text-sm">
        {renderMarkdown(content)}
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
          <div className="flex gap-2 px-3.5 pb-3 pt-0">
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-opacity ${isDanger ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"}`}
            >
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-semibold rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
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
          <div className="px-3.5 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
            {msg.resultText}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentSlideOver() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<Array<{
    id: string;
    preview: string;
    url: string | null;
    uploading: boolean;
    error: string | null;
  }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        // Drop any "typing" messages that were interrupted
        setMessages(parsed.filter((m) => m.type !== "typing"));
      }
    } catch { /* ignore */ }
  }, []);

  // Persist to sessionStorage on every messages change (skip typing frames)
  useEffect(() => {
    const stable = messages.filter((m) => m.type !== "typing");
    if (stable.length > 0) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(stable)); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    pendingImages.forEach((p) => URL.revokeObjectURL(p.preview));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTextHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter((m): m is TextMessage => m.type === "text")
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  function addAssistantMessage(text: string) {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    // Insert a typing placeholder
    setMessages((prev) => [...prev, { type: "typing", role: "assistant", content: "" }]);
    let i = 0;
    const CHUNK = Math.max(1, Math.floor(text.length / 60)); // finish in ~60 frames
    typingTimerRef.current = setInterval(() => {
      i = Math.min(i + CHUNK, text.length);
      setMessages((prev) =>
        prev.map((m) => (m.type === "typing" ? { ...m, content: text.slice(0, i) } : m))
      );
      if (i >= text.length) {
        clearInterval(typingTimerRef.current!);
        typingTimerRef.current = null;
        setMessages((prev) =>
          prev.map((m) => (m.type === "typing" ? { type: "text", role: "assistant", content: text } : m))
        );
      }
    }, 16);
  }

  async function sendMessage() {
    const text = input.trim();
    const readyImages = pendingImages.filter((p) => p.url);
    if ((!text && readyImages.length === 0) || loading) return;
    setInput("");
    setLoading(true);

    const imageUrls = readyImages.map((p) => p.url!);
    removeAllPendingImages();

    // Message displayed in chat
    setMessages((prev) => [...prev, { type: "text", role: "user", content: text, imageUrls: imageUrls.length > 0 ? imageUrls : undefined }]);

    // Message sent to AI: append each image URL as context
    const imageContext = imageUrls.map((url, i) =>
      imageUrls.length === 1 ? `[Imagem anexada pelo usuário: ${url}]` : `[Imagem ${i + 1} anexada pelo usuário: ${url}]`
    ).join("\n");
    const messageForAI = imageContext
      ? `${text}${text ? "\n\n" : ""}${imageContext}`
      : text;

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: getTextHistory(), newMessage: messageForAI, currentPage: pathname }),
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
        addAssistantMessage(data.text!);
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
        setMessages((prev) => [...prev, { ...actionMsg, status: "pending" }]);
      }
    } catch {
      addAssistantMessage("Erro ao conectar com o assistente. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(actionMsg: ActionMessage) {
    setMessages((prev) =>
      prev.map((m) =>
        m.type === "action" && m.toolName === actionMsg.toolName && m.status === "pending"
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
          currentPage: pathname,
        }),
      });
      const data = await res.json() as { success: boolean; aiSummary: string };

      setMessages((prev) =>
        prev.map((m) =>
          m.type === "action" && m.toolName === actionMsg.toolName && m.status === "executing"
            ? { ...m, status: data.success ? "success" : "error" }
            : m
        )
      );

      if (data.success) router.refresh();
      addAssistantMessage(data.aiSummary);
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
      prev.map((m) => (m === actionMsg ? { ...m, status: "cancelled" } : m))
    );
    addAssistantMessage("Tudo bem, ação cancelada.");
  }

  function clearMessages() {
    if (typingTimerRef.current) { clearInterval(typingTimerRef.current); typingTimerRef.current = null; }
    setMessages([]);
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (imageInputRef.current) imageInputRef.current.value = "";

    // Add all selected files as pending immediately
    const newEntries = files.map((file) => ({
      id: Math.random().toString(36).slice(2),
      preview: URL.createObjectURL(file),
      url: null as string | null,
      uploading: true,
      error: null as string | null,
    }));
    setPendingImages((prev) => [...prev, ...newEntries]);

    // Upload each file in parallel
    await Promise.all(newEntries.map(async (entry, idx) => {
      try {
        const fd = new FormData();
        fd.append("file", files[idx]);
        fd.append("folder", "misto/agent");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json() as { url?: string; error?: string };
        if (data.url) {
          setPendingImages((prev) => prev.map((p) => p.id === entry.id ? { ...p, url: data.url!, uploading: false } : p));
        } else {
          setPendingImages((prev) => prev.map((p) => p.id === entry.id ? { ...p, uploading: false, error: data.error ?? "Erro ao enviar." } : p));
        }
      } catch {
        setPendingImages((prev) => prev.map((p) => p.id === entry.id ? { ...p, uploading: false, error: "Erro de conexão." } : p));
      }
    }));
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return prev.filter((p) => p.id !== id);
    });
  }

  function removeAllPendingImages() {
    setPendingImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.preview));
      return [];
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const hasPendingAction = messages.some((m) => m.type === "action" && m.status === "pending");
  const isTyping = messages.some((m) => m.type === "typing");

  return (
    <>
      {/* Floating button — hidden when panel is open to avoid competing with backdrop */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[5.5rem] right-4 md:bottom-6 md:right-6 z-[45] w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
          title="Assistente IA"
        >
          <Bot size={20} />
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over panel — full screen no mobile, 384px fixo no desktop */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Bot size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Assistente Admin</p>
              <p className="text-xs text-muted-foreground">Misto EC</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Limpar conversa"
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                <Bot size={26} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Como posso ajudar?</p>
                <p className="text-xs text-muted-foreground">Experimente:</p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {[
                  "Crie um cupom de 10% OFF geral, limite 1 por cliente",
                  "Liste os pedidos pendentes de hoje",
                  "Quanto custa o ingresso inteira?",
                  "Quais ofertas de upsell estão ativas?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="text-left text-sm px-4 py-3 bg-secondary rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.type === "text" && msg.role === "user") return <UserBubble key={i} content={msg.content} imageUrls={msg.imageUrls} />;
            if (msg.type === "text" && msg.role === "assistant") return <AssistantBubble key={i} content={msg.content} />;
            if (msg.type === "typing") return <AssistantBubble key={i} content={msg.content || "​"} />;
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

          {/* Loading indicator only shown while waiting for network (not while typing) */}
          {loading && !isTyping && (
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

        {/* Input — padding extra para safe-area no iOS */}
        <div
          className="px-4 pt-3 border-t border-border shrink-0"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {hasPendingAction && (
            <p className="text-xs text-amber-500 mb-2 text-center">Confirme ou cancele a ação acima antes de continuar.</p>
          )}

          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 p-2 bg-secondary rounded-xl">
              {pendingImages.map((img) => (
                <div key={img.id} className="relative group shrink-0">
                  <img src={img.preview} alt="preview" className="w-14 h-14 rounded-lg object-cover border border-border" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-white" />
                    </div>
                  )}
                  {img.error && (
                    <div className="absolute inset-0 bg-destructive/70 rounded-lg flex items-center justify-center" title={img.error}>
                      <XCircle size={14} className="text-white" />
                    </div>
                  )}
                  <button
                    onClick={() => removePendingImage(img.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              <p className="w-full text-[11px] text-muted-foreground px-0.5">
                {pendingImages.some((p) => p.uploading)
                  ? "Enviando…"
                  : `${pendingImages.filter((p) => p.url).length} imagem(ns) pronta(s)`}
              </p>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Hidden file input — multiple */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || hasPendingAction}
              title="Anexar imagens"
              className="w-11 h-11 rounded-xl border border-border bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40 shrink-0 relative"
            >
              {pendingImages.some((p) => p.uploading) ? <Loader2 size={17} className="animate-spin" /> : <ImageIcon size={17} />}
              {pendingImages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] font-bold flex items-center justify-center">
                  {pendingImages.length}
                </span>
              )}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || hasPendingAction}
              placeholder={hasPendingAction ? "Aguardando confirmação…" : pendingImages.length > 0 ? "Descreva o que fazer com as imagens…" : "Digite um comando…"}
              rows={1}
              className="flex-1 px-3 py-3 bg-input border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 max-h-32"
              style={{ minHeight: "46px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !pendingImages.some((p) => p.url)) || hasPendingAction || pendingImages.some((p) => p.uploading)}
              className="w-11 h-11 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          {/* Dica só visível em telas maiores — no mobile o teclado é touch */}
          <p className="hidden sm:block text-xs text-muted-foreground mt-1.5 text-center">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </>
  );
}
