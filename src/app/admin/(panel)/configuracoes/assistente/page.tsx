export const dynamic = "force-dynamic";

import { getAIProviders, createAIProvider, updateAIProvider, setActiveAIProvider, deleteAIProvider } from "@/app/actions/ai-config";
import { ChevronLeft, Plus, Zap, Trash2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-8"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro"],
};

export default async function AssistentePage() {
  const providers = await getAIProviders();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link href="/admin/configuracoes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft size={16} />
        Voltar para Configurações
      </Link>

      <div>
        <h2 className="font-display text-xl text-foreground tracking-wide">ASSISTENTE IA</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure o provedor de IA do assistente admin. Apenas um provedor pode estar ativo.</p>
      </div>

      {/* Lista de provedores */}
      {providers.length > 0 && (
        <div className="flex flex-col gap-3">
          {providers.map((p) => (
            <div key={p.id} className={`bg-card border rounded-xl p-4 flex items-center justify-between gap-4 ${p.active ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-center gap-3 min-w-0">
                {p.active ? <CheckCircle2 size={16} className="text-primary shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.provider} · {p.model}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">{p.apiKeyMasked}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!p.active && (
                  <form action={async () => { "use server"; await setActiveAIProvider(p.id); }}>
                    <button type="submit" className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
                      <Zap size={12} /> Ativar
                    </button>
                  </form>
                )}
                <form action={async () => { "use server"; await deleteAIProvider(p.id); }}>
                  <button type="submit" className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de novo provedor */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus size={14} /> Adicionar Provedor
        </h3>
        <form
          action={async (fd: FormData) => {
            "use server";
            await createAIProvider({
              name: fd.get("name") as string,
              provider: fd.get("provider") as string,
              model: fd.get("model") as string,
              apiKey: fd.get("apiKey") as string,
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome (ex: Claude Sonnet)</label>
              <input name="name" required className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Meu Provedor" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Provedor</label>
              <select name="provider" className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {PROVIDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Modelo</label>
            <input name="model" required list="model-suggestions" className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="claude-haiku-4-5-20251001" />
            <datalist id="model-suggestions">
              {Object.values(MODEL_SUGGESTIONS).flat().map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Chave de API</label>
            <input name="apiKey" type="password" required className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono" placeholder="sk-..." />
          </div>
          <button type="submit" className="self-start px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 transition-opacity">
            Salvar Provedor
          </button>
        </form>
      </div>

      <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-4">
        <p className="font-semibold mb-1">Modelos recomendados por custo-benefício:</p>
        <ul className="space-y-0.5">
          <li>• <span className="font-mono">claude-haiku-4-5-20251001</span> — Anthropic, rápido e barato</li>
          <li>• <span className="font-mono">gpt-4o-mini</span> — OpenAI, barato e capaz</li>
          <li>• <span className="font-mono">claude-sonnet-4-6</span> — Anthropic, mais inteligente para comandos complexos</li>
        </ul>
      </div>
    </div>
  );
}
