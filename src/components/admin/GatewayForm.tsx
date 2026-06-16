"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createGateway, updateGateway } from "@/app/actions/admin";

type GatewaySlug = "mercadopago" | "asaas" | "mock";

interface GatewayFormProps {
  mode: "create" | "edit";
  id?: string;
  defaultValues?: {
    name: string;
    slug: string;
    active: boolean;
    credentials: Record<string, string>;
  };
}

const inputClass =
  "bg-input border border-border rounded-md px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring w-full";

const slugOptions: { value: GatewaySlug; label: string }[] = [
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "asaas", label: "Asaas" },
  { value: "mock", label: "Mock (Teste)" },
];

export function GatewayForm({ mode, id, defaultValues }: GatewayFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(defaultValues?.name ?? "");
  const [slug, setSlug] = useState<GatewaySlug>(
    (defaultValues?.slug as GatewaySlug) ?? "mercadopago"
  );
  const [active, setActive] = useState(defaultValues?.active ?? false);

  // Credential fields — always start empty in edit mode (defaultValues have masked values)
  const isEdit = mode === "edit";
  const [accessToken, setAccessToken] = useState(isEdit ? "" : (defaultValues?.credentials?.accessToken ?? ""));
  const [publicKey, setPublicKey] = useState(isEdit ? "" : (defaultValues?.credentials?.publicKey ?? ""));
  const [mpWebhookSecret, setMpWebhookSecret] = useState(isEdit ? "" : (defaultValues?.credentials?.webhookSecret ?? ""));
  const [mpSandbox, setMpSandbox] = useState(defaultValues?.credentials?.sandbox === "true");

  const [apiKey, setApiKey] = useState(isEdit ? "" : (defaultValues?.credentials?.apiKey ?? ""));
  const [asaasWebhookSecret, setAsaasWebhookSecret] = useState(isEdit ? "" : (defaultValues?.credentials?.webhookToken ?? ""));
  const [asaasSandbox, setAsaasSandbox] = useState(defaultValues?.credentials?.sandbox === "true");

  // Track if credentials were changed in edit mode
  const [credentialsChanged, setCredentialsChanged] = useState(mode === "create");

  function buildCredentials(): Record<string, string> {
    if (slug === "mercadopago") {
      return {
        accessToken,
        publicKey,
        webhookSecret: mpWebhookSecret,
        sandbox: String(mpSandbox),
      };
    }
    if (slug === "asaas") {
      return {
        apiKey,
        webhookToken: asaasWebhookSecret,
        sandbox: String(asaasSandbox),
      };
    }
    // mock
    return {};
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createGateway({
          name,
          slug,
          active,
          credentials: buildCredentials(),
        });
        if (!result.success) {
          setError(result.error ?? "Erro ao criar gateway.");
          return;
        }
        router.push("/admin/configuracoes?tab=gateways");
      } else {
        if (!id) return;
        const result = await updateGateway(id, {
          name,
          active,
          credentialsChanged,
          credentials: credentialsChanged ? buildCredentials() : undefined,
        });
        if (!result.success) {
          setError(result.error ?? "Erro ao atualizar gateway.");
          return;
        }
        router.push("/admin/configuracoes?tab=gateways");
      }
    });
  }

  function markCredentialsChanged() {
    if (!credentialsChanged) setCredentialsChanged(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Basic fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            Nome
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Mercado Pago Produção"
            className={inputClass}
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            Slug / Provedor
          </label>
          {mode === "create" ? (
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value as GatewaySlug)}
              className={inputClass}
            >
              {slugOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={slug}
              disabled
              className={`${inputClass} opacity-60 cursor-not-allowed`}
            />
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm text-foreground">Definir como gateway ativo</span>
      </label>

      {/* Credential fields */}
      {slug !== "mock" && (
        <div className="border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-foreground">
              Credenciais
            </h4>
            {mode === "edit" && !credentialsChanged && (
              <button
                type="button"
                onClick={() => setCredentialsChanged(true)}
                className="text-xs text-primary underline"
              >
                Alterar credenciais
              </button>
            )}
          </div>

          {mode === "edit" && !credentialsChanged && (
            <p className="text-xs text-muted-foreground">
              As credenciais atuais estão mascaradas por segurança. Clique em
              &quot;Alterar credenciais&quot; para substituí-las.
            </p>
          )}

          {(mode === "create" || credentialsChanged) && (
            <>
              {slug === "mercadopago" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => {
                        setAccessToken(e.target.value);
                        markCredentialsChanged();
                      }}
                      placeholder="APP_USR-..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Public Key
                    </label>
                    <input
                      type="password"
                      value={publicKey}
                      onChange={(e) => {
                        setPublicKey(e.target.value);
                        markCredentialsChanged();
                      }}
                      placeholder="APP_USR-..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Webhook Secret (opcional)
                    </label>
                    <input
                      type="text"
                      value={mpWebhookSecret}
                      onChange={(e) => {
                        setMpWebhookSecret(e.target.value);
                        markCredentialsChanged();
                      }}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="mpSandbox"
                      checked={mpSandbox}
                      onChange={(e) => {
                        setMpSandbox(e.target.checked);
                        markCredentialsChanged();
                      }}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor="mpSandbox"
                      className="text-sm text-foreground cursor-pointer"
                    >
                      Sandbox (ambiente de teste)
                    </label>
                  </div>
                </div>
              )}

              {slug === "asaas" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-sm text-muted-foreground mb-1 block">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        markCredentialsChanged();
                      }}
                      placeholder="$aact_..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Webhook Secret (opcional)
                    </label>
                    <input
                      type="text"
                      value={asaasWebhookSecret}
                      onChange={(e) => {
                        setAsaasWebhookSecret(e.target.value);
                        markCredentialsChanged();
                      }}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="asaasSandbox"
                      checked={asaasSandbox}
                      onChange={(e) => {
                        setAsaasSandbox(e.target.checked);
                        markCredentialsChanged();
                      }}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor="asaasSandbox"
                      className="text-sm text-foreground cursor-pointer"
                    >
                      Sandbox (ambiente de teste)
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {slug === "mock" && (
        <p className="text-sm text-muted-foreground">
          O gateway Mock não requer credenciais — é utilizado apenas para testes.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending
            ? "Salvando..."
            : mode === "create"
            ? "Criar Gateway"
            : "Salvar Alterações"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/configuracoes?tab=gateways")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
