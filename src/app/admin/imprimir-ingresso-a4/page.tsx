export const dynamic = "force-dynamic";

import { getAdminSession } from "@/app/actions/admin-auth";
import { getTicketsPrintData } from "@/app/actions/courtesy-tickets";
import { redirect } from "next/navigation";
import { PrintAutoTrigger } from "../imprimir-ingresso/PrintAutoTrigger";
import type { TicketPrintData } from "@/app/actions/courtesy-tickets";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function TicketCell({ ticket, num, total }: { ticket: TicketPrintData; num: number; total: number }) {
  const showName = ticket.recipientName !== "Ingresso de Cortesia - Sistema";

  return (
    <div className="ticket">
      {/* Competição */}
      {ticket.game.competition && (
        <div className="competition">{ticket.game.competition}</div>
      )}

      {/* Times */}
      <div className="vs-row">
        <div className="team-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.clubLogoUrl} alt={ticket.clubName} className="team-logo" />
          <span className="team-name">{ticket.clubName}</span>
        </div>
        <span className="vs-label">×</span>
        <div className="team-block">
          {ticket.game.opponentCrestUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ticket.game.opponentCrestUrl} alt={ticket.game.opponent} className="team-logo" />
          ) : (
            <div className="logo-placeholder">{ticket.game.opponent.slice(0, 4)}</div>
          )}
          <span className="team-name">{ticket.game.opponent}</span>
        </div>
      </div>

      {/* Infos do jogo */}
      <div className="separator" />
      <div className="game-info">
        <span className="game-date">{ticket.game.date ? fmtDate(ticket.game.date) : "—"}</span>
        <span className="game-time">{ticket.game.date ? fmtTime(ticket.game.date) : "—"}</span>
      </div>
      <div className="venue">{ticket.game.venue}</div>

      {/* Serial + nome */}
      <div className="separator" />
      <div className="serial-row">
        {showName
          ? <span className="recipient">{ticket.recipientName}</span>
          : <span />}
        <span className="serial">#{String(num).padStart(3, "0")}/{String(total).padStart(3, "0")}</span>
      </div>

      {/* QR grande — ocupa o espaço que sobra, só dele */}
      <div className="qr-area">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ticket.qrDataUrl} alt="QR Code" className="qr-img" />
      </div>

      {/* Disclaimer abaixo do QR */}
      <div className="security-block">
        <div className="security-text">
          DOCUMENTO DE ACESSO OFICIAL. É proibida a reprodução total ou parcial deste ingresso.
          Qualquer tentativa de falsificação, duplicação ou alteração implicará na recusa do acesso
          ao evento e comunicação às autoridades competentes para apuração dos crimes previstos na
          legislação brasileira.
        </div>
        <div className="order-id">
          {ticket.serialNo != null
            ? `CÓD. ${String(ticket.serialNo).padStart(6, "0")}`
            : ticket.ticketId.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Patrocínio (opcional) */}
      {ticket.sponsorLogoUrl && (
        <div className="sponsor-row">
          <span className="sponsor-label">Patrocínio</span>
          <span className={`sponsor-chip${ticket.sponsorLogoTone === "light" ? " sponsor-chip-dark" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.sponsorLogoUrl} alt={ticket.sponsorName ?? "Patrocinador"} className="sponsor-logo" />
          </span>
        </div>
      )}

      <div className="separator" />
      <div className="apolice-line">Apólice 6.063.222 · Chubb Seguros Brasil S.A.</div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ tickets?: string; grid?: string }>;
}

export default async function ImprimirIngressoA4Page({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { tickets: ticketsParam, grid } = await searchParams;
  const ticketIds = (ticketsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ticketIds.length === 0) redirect("/admin/cortesia");

  const printData = await getTicketsPrintData(ticketIds);
  if (!printData || printData.length === 0) redirect("/admin/cortesia");

  // Grade configurável por A4: 3×3 (9/página, padrão) ou 3×4 (12/página).
  const is3x4 = grid === "3x4";
  const rows = is3x4 ? 4 : 3;
  const perPage = rows * 3;
  const gridLabel = is3x4 ? "3×4" : "3×3";

  const pages: TicketPrintData[][] = [];
  for (let i = 0; i < printData.length; i += perPage) {
    pages.push(printData.slice(i, i + perPage));
  }

  const logoUrl = printData[0]?.clubLogoUrl ?? "";

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ── Grid de página ─────────────────────────────── */
        .page {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(${rows}, 1fr);
          gap: 3mm;
          width: 100%;
          height: 277mm; /* A4 297 - 2×8mm margin - 4mm extra */
          page-break-after: always;
          break-after: page;
        }
        .page:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        /* ── Célula de ingresso ─────────────────────────── */
        .ticket {
          position: relative;
          border: 0.6pt dashed #999;
          padding: 1.5mm 2.5mm;
          display: flex;
          flex-direction: column;
          gap: 0.5mm;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .ticket::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("${logoUrl}");
          background-repeat: no-repeat;
          background-position: center;
          background-size: 55%;
          opacity: 0.06;
          pointer-events: none;
        }

        /* ── Tipografia ─────────────────────────────────── */
        .security-text {
          font-size: 4.5pt;
          color: #888;
          text-align: center;
          line-height: 1.3;
          hyphens: auto;
          flex-shrink: 0;
        }
        .apolice-line {
          font-size: 5.5pt;
          color: #666;
          text-align: center;
          line-height: 1.2;
          margin-top: 0.5mm;
          padding-bottom: 1.5mm;
          flex-shrink: 0;
        }
        .competition {
          font-size: 6.5pt;
          font-weight: bold;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.3mm;
          color: #222;
          flex-shrink: 0;
        }
        .separator {
          border-top: 0.5pt solid #ccc;
          margin: 0.2mm 0;
          flex-shrink: 0;
        }

        /* ── Times ─────────────────────────────────────── */
        .vs-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2mm;
          flex-shrink: 0;
        }
        .team-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 16mm;
          gap: 0.5mm;
        }
        .team-logo {
          width: 8mm;
          height: 8mm;
          object-fit: contain;
        }
        .logo-placeholder {
          width: 8mm;
          height: 8mm;
          border: 0.5pt solid #bbb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 5pt;
          font-weight: bold;
          color: #666;
          text-align: center;
        }
        .team-name {
          font-size: 5.5pt;
          font-weight: bold;
          text-align: center;
          line-height: 1.2;
          color: #111;
        }
        .vs-label {
          font-size: 9pt;
          font-weight: bold;
          color: #444;
          flex-shrink: 0;
        }

        /* ── Jogo ───────────────────────────────────────── */
        .game-info {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-shrink: 0;
        }
        .game-date {
          font-size: 6pt;
          color: #333;
        }
        .game-time {
          font-size: 7pt;
          font-weight: bold;
          color: #111;
        }
        .venue {
          font-size: 6pt;
          color: #555;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.2mm;
          flex-shrink: 0;
        }

        /* ── Serial ─────────────────────────────────────── */
        .serial-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .serial {
          font-size: 5.5pt;
          color: #888;
          font-family: 'Courier New', monospace;
          line-height: 1;
          white-space: nowrap;
        }
        .recipient {
          font-size: 6pt;
          color: #444;
          font-style: italic;
          flex-shrink: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── QR (espaço exclusivo, centralizado) ────────── */
        .qr-area {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1mm 0;
        }
        .qr-img {
          height: 100%;
          width: auto;
          max-height: 44mm;
          max-width: 100%;
          object-fit: contain;
          display: block;
        }
        /* ── Disclaimer (abaixo do QR) ──────────────────── */
        .security-block {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 0.8mm;
        }

        /* ── Patrocínio ─────────────────────────────────── */
        .sponsor-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5mm;
          flex-shrink: 0;
          margin-top: 0.3mm;
        }
        .sponsor-label {
          font-size: 4.5pt;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.2mm;
        }
        .sponsor-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sponsor-chip-dark {
          background: #1a1a1a;
          border-radius: 1mm;
          padding: 0.6mm 1.2mm;
        }
        .sponsor-logo {
          height: 5mm;
          max-width: 24mm;
          object-fit: contain;
          display: block;
        }

        /* ── ID do ingresso ─────────────────────────────── */
        .order-id {
          font-size: 8pt;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          color: #222;
          letter-spacing: 0.4mm;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
        }

        /* ── Barra de controle ──────────────────────────── */
        .no-print {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #1a1a1a;
          position: sticky;
          top: 0;
          z-index: 99;
        }
        .btn {
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-family: sans-serif;
          cursor: pointer;
          border: none;
          font-weight: 600;
        }
        .btn-primary { background: #c19a5a; color: #000; }
        .btn-ghost { background: transparent; color: #aaa; border: 1px solid #444; text-decoration: none; }
        .info-text { color: #888; font-size: 12px; font-family: sans-serif; }

        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <PrintAutoTrigger />

      <div className="no-print">
        <button className="btn btn-primary" id="print-btn">Imprimir</button>
        <a href="/admin/cortesia" className="btn btn-ghost">← Voltar</a>
        <span className="info-text">
          {printData.length} ingresso{printData.length > 1 ? "s" : ""} · A4 · {pages.length} página{pages.length > 1 ? "s" : ""} · grade {gridLabel}
        </span>
      </div>

      {pages.map((page, pi) => (
        <div key={pi} className="page">
          {page.map((ticket, ti) => (
            <TicketCell
              key={ticket.ticketId}
              ticket={ticket}
              num={pi * perPage + ti + 1}
              total={printData.length}
            />
          ))}
        </div>
      ))}
    </>
  );
}
