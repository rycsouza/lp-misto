import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Copy,
  MapPin,
  Shirt,
  Ticket,
  Trophy,
} from "lucide-react";
import {
  HOME_GAMES,
  MISTO_CREST,
  TICKET_PRICES,
  RAFFLE_TIERS,
  WHATSAPP_NUMBER,
  PIX_KEY,
  PIX_RECIPIENT,
  type HomeGame,
  type RaffleTier,
} from "@/data/homeGames";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/misto-logotipo.jpeg";

type TicketType = "full" | "half";

const BUYER_FIELDS = ["name", "email", "whatsapp"] as const;
type BuyerField = (typeof BUYER_FIELDS)[number];

const buyerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(100, "Nome muito longo")
    .regex(/^[A-Za-zÀ-ÿ'.\-]+(\s+[A-Za-zÀ-ÿ'.\-]+)+$/, "Informe nome e sobrenome"),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu e-mail")
    .email("E-mail inválido")
    .max(255),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 11, {
      message: "Informe um WhatsApp válido com DDD",
    }),
});

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STEP_LABELS = ["Jogo", "Ingresso", "Sorteio", "Dados", "Pagamento", "Pronto"];

const Stepper = ({ step }: { step: number }) => (
  <ol className="flex items-center justify-between gap-2 mb-8">
    {STEP_LABELS.map((label, i) => {
      const idx = i + 1;
      const active = step === idx;
      const done = step > idx;
      return (
        <li key={label} className="flex-1 flex items-center gap-2 min-w-0">
          <span
            className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-bold border ${
              done
                ? "bg-primary text-primary-foreground border-primary"
                : active
                ? "bg-primary/15 text-primary border-primary"
                : "bg-secondary text-muted-foreground border-border"
            }`}
          >
            {done ? <Check size={14} /> : idx}
          </span>
          <span
            className={`hidden sm:inline text-xs uppercase tracking-wider truncate ${
              active ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
          {idx < STEP_LABELS.length && <span className="flex-1 h-px bg-border ml-1" />}
        </li>
      );
    })}
  </ol>
);

const GameCard = ({
  game,
  selected,
  onSelect,
}: {
  game: HomeGame;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`text-left rounded-xl border p-5 transition-all hover:border-primary/60 ${
      selected ? "border-primary bg-primary/5" : "border-border bg-card"
    }`}
  >
    <div className="text-xs uppercase tracking-widest text-primary font-semibold">
      {game.round}
    </div>
    <div className="flex items-center gap-3 mt-2">
      <img
        src={MISTO_CREST}
        alt="Escudo do Misto Esporte Clube"
        width={48}
        height={48}
        loading="lazy"
        className="h-12 w-12 object-contain"
      />
      <span className="font-display text-2xl text-primary">x</span>
      <img
        src={game.opponentCrest}
        alt={`Escudo do ${game.opponent}`}
        width={48}
        height={48}
        loading="lazy"
        className="h-12 w-12 object-contain"
      />
      <div className="font-display text-xl text-foreground leading-tight">
        Misto EC <span className="text-primary">x</span> {game.opponent}
      </div>
    </div>
    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
      <div className="flex items-start gap-2">
        <Calendar size={14} className="text-primary mt-0.5" />
        <div className="leading-tight">
          <div>{game.dateLabel} · {game.timeLabel}</div>
          <div className="text-xs uppercase tracking-wider text-primary/80">{game.weekdayLabel}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-primary" />
        {game.venue}
      </div>
    </div>
  </button>
);

const TicketPurchase = () => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [gameId, setGameId] = useState<string>(HOME_GAMES[0].id);
  const [ticketType, setTicketType] = useState<TicketType>("full");
  const [quantity, setQuantity] = useState(1);
  const [raffleTier, setRaffleTier] = useState<RaffleTier>(RAFFLE_TIERS[0]);
  const [buyer, setBuyer] = useState({ name: "", email: "", whatsapp: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const game = useMemo(
    () => HOME_GAMES.find((g) => g.id === gameId) ?? HOME_GAMES[0],
    [gameId],
  );

  const unitPrice = ticketType === "full" ? TICKET_PRICES.full : TICKET_PRICES.half;
  const ticketsTotal = unitPrice * quantity;
  const raffleTotal = raffleTier.price;
  const total = ticketsTotal + raffleTotal;

  const goNext = () => setStep((s) => Math.min(s + 1, 6));
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  // Generate QR (simple — links to copiable PIX key)
  useEffect(() => {
    if (step !== 5) return;
    QRCode.toDataURL(PIX_KEY, { width: 320, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [step]);

  const fieldRefs = useRef<Record<BuyerField, HTMLInputElement | null>>({
    name: null,
    email: null,
    whatsapp: null,
  });

  // Autofocus do primeiro campo ao abrir a etapa de dados
  useEffect(() => {
    if (step === 4) {
      requestAnimationFrame(() => fieldRefs.current.name?.focus());
    }
  }, [step]);

  const focusFirstError = (fieldErrors: Record<string, string>) => {
    const first = BUYER_FIELDS.find((f) => fieldErrors[f]);
    if (first) requestAnimationFrame(() => fieldRefs.current[first]?.focus());
  };

  const validateBuyer = () => {
    const parsed = buyerSchema.safeParse(buyer);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0]) fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return null;
    }
    setErrors({});
    return parsed.data;
  };

  const handleBuyerNext = () => {
    if (validateBuyer()) setStep(5);
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      toast({ title: "Chave PIX copiada!", description: "Cole no app do seu banco para pagar." });
    } catch {
      toast({ title: "Não foi possível copiar", description: PIX_KEY });
    }
  };

  const sendWhatsAppConfirmation = () => {
    const lines = [
      "*Pagamento de Ingresso — Misto EC*",
      "",
      `*Jogo:* Misto EC x ${game.opponent} (${game.round})`,
      `*Data:* ${game.weekdayLabel}, ${game.dateLabel} às ${game.timeLabel}`,
      `*Local:* ${game.venue}`,
      "",
      `*Tipo:* ${ticketType === "full" ? "Inteira" : "Meia entrada"}`,
      `*Quantidade:* ${quantity}`,
      `*Sorteio camisa oficial:* ${raffleTier.numbers > 0 ? `${raffleTier.numbers} número(s)` : "Não"}`,
      "",
      `*Total pago via PIX:* ${currency(total)}`,
      "",
      "*Dados do torcedor*",
      `Nome: ${buyer.name}`,
      `E-mail: ${buyer.email}`,
      `WhatsApp: ${buyer.whatsapp}`,
      "",
      "Segue o comprovante do PIX em anexo. 💛🖤",
    ];
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setStep(6);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Misto Esporte Clube" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-display text-base sm:text-xl tracking-wider">
              MISTO ESPORTE CLUBE
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft size={16} /> Voltar
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold">
            <Ticket size={14} /> Compra de ingresso
          </div>
          <h1 className="font-display text-4xl sm:text-5xl mt-2 leading-tight">
            Garanta sua presença no <span className="text-primary">Madrugadão</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Escolha o jogo, o tipo de ingresso e pague via PIX em poucos passos.
          </p>
        </div>

        <Stepper step={step} />

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-border bg-card p-6 sm:p-8"
        >
          {step === 1 && (
            <div>
              <h2 className="font-display text-2xl mb-4">Escolha o jogo</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {HOME_GAMES.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    selected={g.id === gameId}
                    onSelect={() => setGameId(g.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-2xl mb-1">Tipo de ingresso</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Misto EC x {game.opponent} · {game.weekdayLabel}, {game.dateLabel} · {game.timeLabel}
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {([
                  { key: "full", label: "Inteira", price: TICKET_PRICES.full },
                  { key: "half", label: "Meia entrada", price: TICKET_PRICES.half },
                ] as { key: TicketType; label: string; price: number }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setTicketType(opt.key)}
                    className={`rounded-xl border p-5 text-left transition-all ${
                      ticketType === opt.key
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/40 hover:border-primary/60"
                    }`}
                  >
                    <div className="font-display text-xl">{opt.label}</div>
                    <div className="font-display text-3xl text-primary mt-1">
                      {currency(opt.price)}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <label className="text-sm text-muted-foreground">Quantidade</label>
                <div className="mt-2 inline-flex items-center rounded-lg border border-border bg-secondary/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-4 py-2 hover:bg-secondary"
                  >
                    −
                  </button>
                  <span className="px-5 font-display text-lg">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    className="px-4 py-2 hover:bg-secondary"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="inline-flex items-center gap-2 text-accent font-semibold uppercase tracking-wider text-xs">
                <Trophy size={14} /> Concorra a prêmios oficiais
              </div>
              <h2 className="font-display text-2xl mt-2 mb-2">
                Leve <span className="text-accent">números da sorte</span> e dispute camisas oficiais do Misto
              </h2>
              <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 mb-5 flex gap-3">
                <Shirt className="text-accent shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-foreground/90">
                  A cada número da sorte adquirido, você concorre a <strong>camisas oficiais do time</strong>.
                  O sorteio acontece <strong>ao vivo, no intervalo do jogo</strong>, direto do Madrugadão.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {RAFFLE_TIERS.map((tier) => {
                  const selected = tier.numbers === raffleTier.numbers;
                  const isBest = tier.numbers === 3;
                  return (
                    <button
                      key={tier.numbers}
                      type="button"
                      onClick={() => setRaffleTier(tier)}
                      className={`relative rounded-xl border p-5 text-left transition-all ${
                        selected
                          ? "border-accent bg-accent/10"
                          : "border-border bg-secondary/40 hover:border-accent/60"
                      }`}
                    >
                      {isBest && (
                        <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-widest bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-bold">
                          Melhor oferta
                        </span>
                      )}
                      <div className="font-display text-xl">{tier.label}</div>
                      <div className="font-display text-3xl text-accent mt-1">
                        {tier.price === 0 ? "Grátis" : `+ ${currency(tier.price)}`}
                      </div>
                      {tier.numbers > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tier.numbers}× chance{tier.numbers > 1 ? "s" : ""} de ganhar
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-2xl mb-1">Seus dados</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Usaremos para confirmar seu pedido e enviar o ingresso.
              </p>

              <div className="grid gap-4">
                {([
                  { key: "name", label: "Nome completo", type: "text", placeholder: "Ex.: João da Silva", inputMode: undefined, autoComplete: "name" },
                  { key: "email", label: "E-mail", type: "email", placeholder: "voce@exemplo.com", inputMode: "email" as const, autoComplete: "email" },
                  { key: "whatsapp", label: "WhatsApp (com DDD)", type: "tel", placeholder: "(67) 99999-9999", inputMode: "tel" as const, autoComplete: "tel" },
                ] as { key: BuyerField; label: string; type: string; placeholder: string; inputMode?: "email" | "tel"; autoComplete: string }[]).map((f) => (
                  <div key={f.key}>
                    <label htmlFor={`buyer-${f.key}`} className="text-sm text-muted-foreground">
                      {f.label}
                    </label>
                    <input
                      id={`buyer-${f.key}`}
                      ref={(el) => (fieldRefs.current[f.key] = el)}
                      type={f.type}
                      inputMode={f.inputMode}
                      autoComplete={f.autoComplete}
                      value={buyer[f.key]}
                      onChange={(e) => {
                        const v =
                          f.key === "whatsapp" ? formatPhone(e.target.value) : e.target.value;
                        setBuyer((b) => ({ ...b, [f.key]: v }));
                        if (errors[f.key]) setErrors((er) => ({ ...er, [f.key]: "" }));
                      }}
                      onBlur={(e) => {
                        if (f.key === "whatsapp") {
                          setBuyer((b) => ({ ...b, whatsapp: formatPhone(e.target.value) }));
                        }
                      }}
                      placeholder={f.placeholder}
                      aria-invalid={!!errors[f.key]}
                      className={`mt-1 w-full rounded-lg border bg-secondary/40 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors[f.key] ? "border-destructive" : "border-input"
                      }`}
                    />
                    {errors[f.key] && (
                      <p className="text-xs text-destructive mt-1">{errors[f.key]}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 className="font-display text-2xl mb-1">Pagamento via PIX</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Pague em segundos no app do seu banco. Em seguida, envie o comprovante pelo WhatsApp.
              </p>

              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="rounded-xl border border-border bg-white p-5 grid place-items-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code PIX" className="w-56 h-56" />
                  ) : (
                    <div className="w-56 h-56 grid place-items-center text-muted-foreground text-sm">
                      Gerando QR Code…
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Aponte a câmera do seu app de banco
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Valor a pagar
                    </div>
                    <div className="font-display text-4xl text-primary">{currency(total)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Recebedor: {PIX_RECIPIENT}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Chave PIX (telefone)
                    </div>
                    <div className="flex items-stretch gap-2">
                      <div className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-3 font-mono text-sm break-all">
                        {PIX_KEY}
                      </div>
                      <button
                        type="button"
                        onClick={copyPix}
                        className="inline-flex items-center gap-1 px-4 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                      >
                        <Copy size={16} /> Copiar
                      </button>
                    </div>
                  </div>

                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Abra o app do seu banco e escolha pagar com PIX.</li>
                    <li>Escaneie o QR Code ou cole a chave copiada.</li>
                    <li>Confirme o valor de <strong className="text-foreground">{currency(total)}</strong>.</li>
                    <li>Envie o comprovante pelo WhatsApp para liberarmos seu ingresso.</li>
                  </ol>

                  <button
                    type="button"
                    onClick={sendWhatsAppConfirmation}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                  >
                    Já paguei — enviar comprovante <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="text-center py-8">
              <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 grid place-items-center text-primary">
                <Check size={28} />
              </div>
              <h2 className="font-display text-3xl mt-4">Pedido enviado!</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Acabamos de abrir uma conversa no WhatsApp. Envie o comprovante do PIX para confirmarmos
                seu ingresso{raffleTier.numbers > 0 ? " e seus números da sorte" : ""}.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 mt-6 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg hover:bg-primary/90"
              >
                Voltar para o site
              </Link>
            </div>
          )}
        </motion.div>

        {step < 5 && (
          <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm">
              <div className="text-muted-foreground">Resumo</div>
              <div className="font-display text-lg leading-tight">
                {quantity}× {ticketType === "full" ? "Inteira" : "Meia"}
                {raffleTier.numbers > 0 ? ` · ${raffleTier.numbers} nº da sorte` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {game.weekdayLabel}, {game.dateLabel} · {game.timeLabel} · {game.venue}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                <div className="font-display text-2xl text-primary">{currency(total)}</div>
              </div>
              <div className="flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="px-4 py-2 rounded-lg border border-border hover:bg-secondary"
                  >
                    Voltar
                  </button>
                )}
                {step < 4 && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-1 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                  >
                    Continuar <ChevronRight size={16} />
                  </button>
                )}
                {step === 4 && (
                  <button
                    type="button"
                    onClick={handleBuyerNext}
                    className="inline-flex items-center gap-1 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                  >
                    Ir para o PIX <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketPurchase;
