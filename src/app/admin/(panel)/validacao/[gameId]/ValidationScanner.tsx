"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import {
  validateTicket,
  getGameValidationStats,
  getRecentValidations,
} from "@/app/actions/validations";
import {
  Camera, CameraOff, Loader2, CheckCircle2, XCircle,
  AlertCircle, Users, Ticket, ScanLine, ChevronRight, ArrowLeft,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Stats = { totalOrders: number; totalTickets: number };
type RecentRow = Awaited<ReturnType<typeof getRecentValidations>>[number];
type TicketType = { typeCode: string; typeName: string; total: number; validated: number };

type FlashState = {
  ok: boolean;
  headline: string;
  sub?: string;
  name?: string;
} | null;

type LastResult = { ok: boolean; headline: string; detail: string; name?: string; at: Date } | null;

// ─── Audio feedback ─────────────────────────────────────────────────────────

function beep(freq: number, durationMs: number, vol = 0.35) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.start();
    gain.gain.setTargetAtTime(0, ctx.currentTime + durationMs / 1000 - 0.05, 0.02);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch { /* Safari blocks AudioContext before user gesture; silently fail */ }
}

const beepOk = () => { beep(880, 120); setTimeout(() => beep(1046, 120), 140); };
const beepErr = () => beep(180, 450, 0.4);
const beepDup = () => { beep(440, 120); setTimeout(() => beep(330, 200), 140); };

// ─── Time helper ─────────────────────────────────────────────────────────────

function timeSince(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 10) return "agora";
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

const HEADLINE_MAP: Record<string, string> = {
  invalid_qr: "QR inválido",
  not_found: "Não encontrado",
  not_paid: "Não pago",
  no_tickets: "Sem ingressos",
  wrong_game: "Jogo errado",
  wrong_type: "Tipo errado",
  already_validated: "Já utilizado",
  error: "Erro",
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

interface Props {
  gameId: string;
  initialStats: Stats;
  initialRecent: RecentRow[];
  ticketTypes: TicketType[];
}

export function ValidationScanner({ gameId, initialStats, initialRecent, ticketTypes }: Props) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [recent, setRecent] = useState<RecentRow[]>(initialRecent);
  const [flash, setFlash] = useState<FlashState>(null);
  const [lastResult, setLastResult] = useState<LastResult>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [isPending, startTransition] = useTransition();

  // Auto-skip type selection when there are no typed tickets (legacy-only games)
  const [selectedType, setSelectedType] = useState<{ typeCode: string; typeName: string } | null>(
    ticketTypes.length === 0 ? { typeCode: "all", typeName: "Todos os tipos" } : null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const flashTimerRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll stats + recent every 5s (atomic reads from DB)
  useEffect(() => {
    const id = window.setInterval(async () => {
      const [s, r] = await Promise.all([
        getGameValidationStats(gameId),
        getRecentValidations(gameId, 12),
      ]);
      setStats(s);
      setRecent(r);
    }, 5000);
    return () => clearInterval(id);
  }, [gameId]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
    }
  }, []);

  // ── Core validate logic ───────────────────────────────────────────────────

  const processResult = useCallback((result: Awaited<ReturnType<typeof validateTicket>>) => {
    clearTimeout(flashTimerRef.current);

    if (result.ok) {
      beepOk();
      setFlash({
        ok: true,
        headline: "Aprovado!",
        sub: result.typeName,
        name: result.customerName,
      });
      setLastResult({
        ok: true,
        headline: "Aprovado",
        detail: result.typeName ?? `${result.ticketQuantity} ingresso(s)`,
        name: result.customerName,
        at: new Date(),
      });
      setStats((prev) => ({
        totalOrders: prev.totalOrders + 1,
        totalTickets: prev.totalTickets + result.ticketQuantity,
      }));
    } else {
      if (result.reason === "already_validated") {
        beepDup();
      } else {
        beepErr();
      }
      const headline = HEADLINE_MAP[result.reason] ?? "Recusado";
      setFlash({ ok: false, headline, sub: result.message });
      setLastResult({ ok: false, headline, detail: result.message, at: new Date() });
    }

    flashTimerRef.current = window.setTimeout(() => setFlash(null), result.ok ? 2200 : 4000);
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 2500);
  }, []);

  const handleScan = useCallback((value: string) => {
    if (cooldownRef.current || isPending) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    setManualInput("");
    startTransition(async () => {
      const result = await validateTicket(trimmed, gameId, selectedType?.typeCode);
      processResult(result);
      const [s, r] = await Promise.all([
        getGameValidationStats(gameId),
        getRecentValidations(gameId, 12),
      ]);
      setStats(s);
      setRecent(r);
    });
  }, [gameId, isPending, processResult, selectedType]);

  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  // ── Camera scanning ───────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if ("permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (perm.state === "denied") {
          setCameraError(
            "Câmera bloqueada. Toque no ícone de câmera na barra de endereço do navegador e permita o acesso, depois recarregue a página."
          );
          return;
        }
      } catch { /* ignore */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      if (streamRef.current) {
        (streamRef.current as MediaStream).getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        setCameraError("Permissão de câmera negada. Toque no ícone de câmera na barra de endereço e permita o acesso.");
      } else if (msg.includes("NotReadable") || msg.includes("in use") || msg.includes("Could not start")) {
        setCameraError("A câmera está em uso por outro app/aba. Feche os outros usos e tente de novo.");
      } else {
        setCameraError("Não foi possível acessar a câmera. Tente novamente.");
      }
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch(() => { /* ignore */ });

    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      const hasNative = "BarcodeDetector" in window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = hasNative ? new (window as any).BarcodeDetector({ formats: ["qr_code"] }) : null;
      const jsQR = hasNative ? null : (await import("jsqr")).default;
      if (cancelled) return;

      scanIntervalRef.current = window.setInterval(async () => {
        const v = videoRef.current;
        if (!v || cooldownRef.current || !v.videoWidth) return;
        try {
          if (detector) {
            const codes = await detector.detect(v);
            if (codes.length > 0) handleScanRef.current(codes[0].rawValue as string);
          } else if (jsQR && ctx) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code?.data) handleScanRef.current(code.data);
          }
        } catch { /* ignore decode errors */ }
      }, 300);
    })();

    return () => {
      cancelled = true;
      clearInterval(scanIntervalRef.current);
    };
  }, [cameraActive]);

  useEffect(() => () => { stopCamera(); clearTimeout(flashTimerRef.current); }, [stopCamera]);

  // ── Manual input handlers ─────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleScan(manualInput);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (text.trim()) handleScan(text.trim());
  }

  // ── Type selection step ───────────────────────────────────────────────────

  if (!selectedType) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-base font-semibold text-foreground mb-0.5">Tipo de ingresso</p>
          <p className="text-xs text-muted-foreground mb-5">
            Selecione o tipo a validar. Ingressos de outros tipos serão recusados.
          </p>
          <div className="flex flex-col gap-2">
            {ticketTypes.map((t) => {
              const pct = t.total > 0 ? Math.round((t.validated / t.total) * 100) : 0;
              return (
                <button
                  key={t.typeCode}
                  onClick={() => setSelectedType({ typeCode: t.typeCode, typeName: t.typeName })}
                  className="w-full flex items-center gap-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/40 rounded-xl px-4 py-4 transition-colors text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Ticket size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{t.typeName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {t.validated}/{t.total}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </button>
              );
            })}

            <button
              onClick={() => setSelectedType({ typeCode: "all", typeName: "Todos os tipos" })}
              className="w-full flex items-center gap-4 bg-secondary/40 hover:bg-secondary border border-border hover:border-border rounded-xl px-4 py-3.5 transition-colors text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <ScanLine size={20} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-muted-foreground text-sm">Todos os tipos</p>
                <p className="text-xs text-muted-foreground/70">Sem filtro por tipo de ingresso</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Scanner render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 relative">

      {/* ── Flash overlay ──────────────────────────────────────────────── */}
      {flash && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 pointer-events-none
            ${flash.ok ? "bg-green-500/90" : "bg-red-500/90"}`}
        >
          {flash.ok ? (
            <CheckCircle2 size={88} className="text-white" strokeWidth={1.5} />
          ) : (
            <XCircle size={88} className="text-white" strokeWidth={1.5} />
          )}
          <p className="text-white font-black text-4xl tracking-wide">{flash.headline}</p>
          {flash.name && (
            <p className="text-white font-bold text-xl text-center px-6">{flash.name}</p>
          )}
          {flash.sub && (
            <p className="text-white/90 text-base text-center px-6 bg-white/20 rounded-full py-1.5 px-5">
              {flash.sub}
            </p>
          )}
        </div>
      )}

      {/* ── Type badge + change button ──────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Ticket size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
              Validando
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{selectedType.typeName}</p>
          </div>
        </div>
        <button
          onClick={() => { stopCamera(); setSelectedType(null); setLastResult(null); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft size={13} />
          Trocar
        </button>
      </div>

      {/* ── Counter ────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Ticket size={28} className="text-primary" />
          </div>
          <div>
            <p className="text-5xl font-black text-foreground leading-none tabular-nums">
              {stats.totalTickets}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              ingresso{stats.totalTickets !== 1 ? "s" : ""} validado{stats.totalTickets !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground tabular-nums">{stats.totalOrders}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            <Users size={11} /> pedidos
          </p>
        </div>
      </div>

      {/* ── Camera area ────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {cameraActive ? (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full aspect-[4/3] object-cover"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-primary/70 animate-pulse" />
              </div>
            </div>
            {isPending && (
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs rounded-full px-2 py-1 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Validando...
              </div>
            )}
            <button
              onClick={stopCamera}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 text-white text-sm rounded-full px-4 py-2"
            >
              <CameraOff size={15} /> Parar câmera
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {cameraSupported && (
              <>
                <button
                  onClick={startCamera}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-4 text-base font-semibold hover:opacity-90 transition-opacity"
                >
                  <Camera size={20} />
                  Escanear com câmera
                </button>
                {cameraError ? (
                  <p className="text-destructive text-xs flex items-center gap-1.5 bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="shrink-0" /> {cameraError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    O navegador solicitará permissão de câmera na primeira vez.
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <ScanLine size={13} />
                Código manual / leitor Bluetooth
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Cole ou escaneie o código..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  onClick={() => handleScan(manualInput)}
                  disabled={isPending || !manualInput.trim()}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {isPending ? <Loader2 size={16} className="animate-spin" /> : "OK"}
                </button>
              </div>
              {!cameraSupported && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Câmera não disponível neste navegador. Use o campo acima com um leitor de código ou cole o UUID do pedido.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Last scan result ───────────────────────────────────────────── */}
      {lastResult && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
          lastResult.ok
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          {lastResult.ok
            ? <CheckCircle2 size={18} className="shrink-0" />
            : <XCircle size={18} className="shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {lastResult.name ? `${lastResult.name} — ${lastResult.headline}` : lastResult.headline}
            </p>
            <p className="text-xs opacity-80">{lastResult.detail}</p>
          </div>
          <span className="text-xs opacity-60 shrink-0">{timeSince(lastResult.at.toISOString())}</span>
        </div>
      )}

      {/* ── Recent validations ─────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold px-4 pt-4 pb-2">
            Últimas validações
          </p>
          <ul className="divide-y divide-border">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.ticketQuantity} ingresso{row.ticketQuantity > 1 ? "s" : ""} · por {row.validatedBy}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeSince(row.validatedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
