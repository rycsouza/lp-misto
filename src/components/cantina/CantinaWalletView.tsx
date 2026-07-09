"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getCantinaWallet, type CantinaWallet } from "@/app/actions/cantina";
import { usePhoneSession } from "@/hooks/usePhoneSession";

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

export function CantinaWalletView({ initialTel = "" }: { initialTel?: string }) {
  const { phone: savedPhone, setPhone: savePhone } = usePhoneSession();
  const [phone, setPhone] = useState(fmtPhone(initialTel));
  const [wallet, setWallet] = useState<CantinaWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const didInit = useRef(false);

  const search = useCallback(async (digits: string) => {
    if (digits.length < 10) return;
    setLoading(true);
    savePhone(fmtPhone(digits)); // persiste p/ próximas telas (mesmo storage do checkout)
    const w = await getCantinaWallet(digits);
    setWallet(w);
    setSearched(true);
    setLoading(false);
  }, [savePhone]);

  // Pré-preenche e busca uma vez: ?tel= (pós-compra) tem prioridade; senão, o
  // telefone salvo da sessão (localStorage `misto_phone`, compartilhado c/ o checkout).
  useEffect(() => {
    if (didInit.current) return;
    const fromParam = initialTel.replace(/\D/g, "");
    const digits = fromParam.length >= 10 ? fromParam : savedPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      didInit.current = true;
      /* eslint-disable react-hooks/set-state-in-effect */
      setPhone(fmtPhone(digits));
      search(digits);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [initialTel, savedPhone, search]);

  const totalRemaining = wallet?.vouchers?.reduce((a, v) => a + v.qtyRemaining, 0) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
        <label className="text-sm text-muted-foreground">Seu WhatsApp</label>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="(00) 00000-0000"
            value={phone}
            onChange={(e) => setPhone(fmtPhone(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter") search(phone.replace(/\D/g, "")); }}
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => search(phone.replace(/\D/g, ""))}
            disabled={loading || phone.replace(/\D/g, "").length < 10}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "…" : "Ver"}
          </button>
        </div>
      </div>

      {searched && wallet && (!wallet.found || totalRemaining === 0) && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhum vale disponível para este número. Compras aparecem aqui após a confirmação do pagamento.
        </div>
      )}

      {wallet?.found && totalRemaining > 0 && (
        <>
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Apresente no balcão</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={wallet.walletToken ?? ""} size={200} />
            </div>
            <p className="text-sm text-foreground font-medium">{wallet.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {totalRemaining} {totalRemaining === 1 ? "item disponível" : "itens disponíveis"} para retirada
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold px-4 pt-4 pb-2">
              Meus vales
            </p>
            <ul className="divide-y divide-border">
              {wallet.vouchers!.map((v) => (
                <li key={v.voucherId} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {v.itemName}
                      {v.needsPrep && <span className="ml-1.5 text-[10px] text-amber-500 uppercase">preparo</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{brl(v.unitPriceCents)} un.</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                    {v.qtyRemaining}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
