"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { getBarTabForDelivery, deliverBarTab, type BarTabView } from "@/app/actions/bar";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function BarBalcao() {
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<BarTabView | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lookup = useCallback((raw: string) => {
    const m = raw.match(UUID_RE);
    if (!m) {
      setFeedback({ tone: "err", msg: "QR/código inválido." });
      return;
    }
    const orderId = m[0];
    startTransition(async () => {
      const t = await getBarTabForDelivery(orderId);
      if (!t) {
        setTab(null);
        setFeedback({ tone: "err", msg: "Ficha não encontrada." });
      } else {
        setTab(t);
        setFeedback(null);
      }
    });
  }, []);

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
            const raw = codes[0].rawValue;
            stopCamera();
            lookup(raw);
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

  function deliver() {
    if (!tab) return;
    startTransition(async () => {
      const res = await deliverBarTab(tab.orderId);
      if (res.success) {
        setFeedback({ tone: "ok", msg: `Entregue: ${tab.customerName}` });
        setTab(null);
        setCode("");
      } else {
        setFeedback({ tone: "err", msg: res.error ?? "Não foi possível entregar." });
      }
    });
  }

  const ready = tab?.status === "paid" && tab?.fulfillmentStatus === "ready";

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4">
      {/* Câmera */}
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
            Bipar QR (câmera)
          </button>
        )}
      </div>

      {/* Manual */}
      <div className="flex gap-2">
        <input
          type="text" placeholder="Código da ficha (manual)" value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) lookup(code.trim()); }}
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <button type="button" onClick={() => code.trim() && lookup(code.trim())} disabled={isPending}
          className="bg-secondary text-secondary-foreground rounded-lg px-4 text-sm font-medium disabled:opacity-50">
          Buscar
        </button>
      </div>

      {feedback && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.tone === "ok" ? "bg-green-500/15 text-green-500" : "bg-destructive/10 text-destructive"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Ficha encontrada */}
      {tab && (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">{tab.customerName}</span>
            <span className="text-[11px] text-muted-foreground font-mono">#{tab.orderId.slice(0, 8)}</span>
          </div>
          <ul className="flex flex-col gap-1 text-sm border-y border-border py-3">
            {tab.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-foreground"><span className="text-muted-foreground">{it.quantity}×</span> {it.name}</span>
                {it.needsPrep && <span className="text-[10px] text-amber-500 uppercase">preparo</span>}
              </li>
            ))}
          </ul>
          {ready ? (
            <button type="button" onClick={deliver} disabled={isPending}
              className="bg-green-600 text-white rounded-lg py-3 text-base font-semibold hover:opacity-90 disabled:opacity-50">
              Entregar tudo
            </button>
          ) : (
            <p className="text-sm text-center text-muted-foreground py-1">
              {tab.fulfillmentStatus === "delivered" ? "Já entregue." : tab.status !== "paid" ? "Ficha não paga." : "Ainda em preparo."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
