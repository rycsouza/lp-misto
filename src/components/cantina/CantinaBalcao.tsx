"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import {
  getCantinaWalletForCounter,
  getCantinaWalletForCounterByPhone,
  redeemCantina,
  type CantinaWallet,
} from "@/app/actions/cantina";

function brl(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function CantinaBalcao() {
  const [phone, setPhone] = useState("");
  const [wallet, setWallet] = useState<CantinaWallet | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyWallet = useCallback((w: CantinaWallet) => {
    if (!w.found || !w.vouchers || w.vouchers.length === 0) {
      setWallet(null);
      setPick({});
      setFeedback({ tone: "err", msg: "Nenhum vale disponível para este cliente." });
    } else {
      setWallet(w);
      setPick({});
      setFeedback(null);
    }
  }, []);

  // Câmera → QR da carteira (token assinado).
  const lookup = useCallback((raw: string) => {
    const token = raw.trim();
    if (!token) {
      setFeedback({ tone: "err", msg: "QR/código inválido." });
      return;
    }
    startTransition(async () => {
      applyWallet(await getCantinaWalletForCounter(token));
    });
  }, [applyWallet]);

  // Manual → WhatsApp do cliente.
  const lookupByPhone = useCallback(() => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setFeedback({ tone: "err", msg: "Informe um WhatsApp válido." });
      return;
    }
    startTransition(async () => {
      applyWallet(await getCantinaWalletForCounterByPhone(digits));
    });
  }, [phone, applyWallet]);

  const stopCamera = useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o?: { formats?: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    if (!Ctor) {
      setFeedback({ tone: "err", msg: "Câmera não suportada neste navegador — use o campo manual." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      const detector = new Ctor({ formats: ["qr_code"] });
      loopRef.current = setInterval(async () => {
        if (!videoRef.current || document.hidden) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            stopCamera();
            lookup(codes[0].rawValue);
          }
        } catch {
          /* frame sem QR */
        }
      }, 300);
    } catch {
      setFeedback({ tone: "err", msg: "Não foi possível acessar a câmera." });
      setScanning(false);
    }
  }, [lookup, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const totalPicked = Object.values(pick).reduce((a, n) => a + n, 0);

  function setQty(voucherId: string, next: number, max: number) {
    setPick((p) => ({ ...p, [voucherId]: Math.min(max, Math.max(0, next)) }));
  }

  function confirm() {
    if (!wallet?.walletToken) return;
    const items = Object.entries(pick)
      .filter(([, q]) => q > 0)
      .map(([voucherId, qty]) => ({ voucherId, qty }));
    if (items.length === 0) return;
    startTransition(async () => {
      const res = await redeemCantina({ walletToken: wallet.walletToken!, items });
      if (!res.success) {
        setFeedback({ tone: "err", msg: res.error ?? "Não foi possível registrar a retirada." });
        return;
      }
      setFeedback({
        tone: "ok",
        msg:
          res.status === "delivered"
            ? `Retirada entregue: ${wallet.customerName}`
            : `Enviado para o preparo — ${wallet.customerName}. Chame quando ficar pronto.`,
      });
      setWallet(null);
      setPick({});
      setPhone("");
    });
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
        <div className="relative aspect-square bg-black rounded-xl overflow-hidden flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {!scanning && <span className="absolute text-sm text-white/70">Câmera desligada</span>}
        </div>
        {scanning ? (
          <button type="button" onClick={stopCamera} className="bg-secondary text-secondary-foreground rounded-lg py-2 text-sm font-medium">
            Parar câmera
          </button>
        ) : (
          <button type="button" onClick={startCamera} className="bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold">
            Bipar carteira (câmera)
          </button>
        )}
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1 text-center">ou busque pelo WhatsApp do cliente</p>
        <div className="flex gap-2">
          <input
            type="tel" inputMode="numeric" placeholder="(67) 99999-9999" value={phone}
            onChange={(e) => setPhone(fmtPhone(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") lookupByPhone(); }}
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="button" onClick={lookupByPhone} disabled={isPending || phone.replace(/\D/g, "").length < 10}
            className="bg-secondary text-secondary-foreground rounded-lg px-4 text-sm font-medium disabled:opacity-50">
            Buscar
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.tone === "ok" ? "bg-green-500/15 text-green-500" : "bg-destructive/10 text-destructive"}`}>
          {feedback.msg}
        </div>
      )}

      {wallet?.found && wallet.vouchers && (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <span className="font-medium text-foreground">{wallet.customerName}</span>
          <ul className="flex flex-col gap-2 border-y border-border py-3">
            {wallet.vouchers.map((v) => {
              const q = pick[v.voucherId] ?? 0;
              return (
                <li key={v.voucherId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {v.itemName}
                      {v.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase">preparo</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{brl(v.unitPriceCents)} · saldo {v.qtyRemaining}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setQty(v.voucherId, q - 1, v.qtyRemaining)} disabled={q === 0}
                      className="w-8 h-8 rounded-lg bg-secondary text-foreground text-lg leading-none disabled:opacity-40">−</button>
                    <span className="w-6 text-center text-sm tabular-nums">{q}</span>
                    <button type="button" onClick={() => setQty(v.voucherId, q + 1, v.qtyRemaining)} disabled={q >= v.qtyRemaining}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-lg leading-none disabled:opacity-40">+</button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button" onClick={confirm} disabled={isPending || totalPicked === 0}
            className="bg-green-600 text-white rounded-lg py-3 text-base font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {totalPicked === 0 ? "Selecione as quantidades" : `Confirmar retirada (${totalPicked})`}
          </button>
        </div>
      )}
    </div>
  );
}
