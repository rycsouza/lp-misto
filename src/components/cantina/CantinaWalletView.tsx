"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Search, RefreshCw, Ticket } from "lucide-react";
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
    <div className="flex flex-col">
      {/* Busca — mesmo padrão de "Meus Pedidos" */}
      <div className="flex gap-3 mb-8">
        <input
          type="tel"
          inputMode="numeric"
          placeholder="(67) 99999-9999"
          value={phone}
          onChange={(e) => setPhone(fmtPhone(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") search(phone.replace(/\D/g, "")); }}
          className="flex-1 px-4 py-3 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => search(phone.replace(/\D/g, ""))}
          disabled={loading || phone.replace(/\D/g, "").length < 10}
          className="px-5 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 font-semibold text-sm"
        >
          {loading
            ? <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            : <Search size={16} />}
          Buscar
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <RefreshCw size={16} className="animate-spin" />
          Buscando seus vales...
        </div>
      )}

      {/* Vazio */}
      {!loading && searched && wallet && (!wallet.found || totalRemaining === 0) && (
        <div className="text-center py-12">
          <Ticket size={48} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">
            Nenhum vale disponível para este número.
          </p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Compras aparecem aqui após a confirmação do pagamento.
          </p>
        </div>
      )}

      {!loading && wallet?.found && totalRemaining > 0 && (
        <div className="flex flex-col gap-5">
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
        </div>
      )}
    </div>
  );
}
