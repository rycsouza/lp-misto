export const dynamic = "force-dynamic";

import { getAdminSession } from "@/app/actions/admin-auth";
import { getTicketsPrintData } from "@/app/actions/courtesy-tickets";
import { redirect } from "next/navigation";
import { PrintAutoTrigger } from "./PrintAutoTrigger";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
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

interface PageProps {
  searchParams: Promise<{ tickets?: string }>;
}

export default async function ImprimirIngressoPage({ searchParams }: PageProps) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const { tickets: ticketsParam } = await searchParams;
  const ticketIds = (ticketsParam ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ticketIds.length === 0) redirect("/admin/cortesia");

  const printData = await getTicketsPrintData(ticketIds);
  if (!printData || printData.length === 0) redirect("/admin/cortesia");

  return (
    <>
      <style>{`
        @page {
          size: 58mm auto;
          margin: 3mm 2mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-family: 'Courier New', Courier, monospace;
          font-size: 9pt;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt {
          width: 54mm;
          padding: 2mm 0;
          page-break-after: always;
          page-break-inside: avoid;
        }
        .receipt:last-child {
          page-break-after: auto;
        }
        .center { text-align: center; }
        .divider {
          border: none;
          border-top: 1px dashed #000;
          margin: 3mm 0;
        }
        .double-divider {
          border: none;
          border-top: 2px solid #000;
          margin: 2mm 0;
        }
        .club-logo {
          display: block;
          margin: 0 auto 2mm;
          width: 14mm;
          height: 14mm;
          object-fit: contain;
        }
        .vs-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2mm;
          margin: 2mm 0;
        }
        .team-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 16mm;
        }
        .team-logo {
          width: 11mm;
          height: 11mm;
          object-fit: contain;
        }
        .team-name {
          font-size: 7pt;
          font-weight: bold;
          text-align: center;
          margin-top: 1mm;
          line-height: 1.1;
          word-break: break-word;
        }
        .vs-label {
          font-size: 8pt;
          font-weight: bold;
          color: #555;
        }
        .game-info {
          font-size: 7.5pt;
          text-align: center;
          line-height: 1.5;
          color: #333;
        }
        .ticket-header {
          font-size: 10pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 0.5mm;
          text-transform: uppercase;
        }
        .ticket-type {
          font-size: 9pt;
          text-align: center;
          color: #333;
        }
        .recipient {
          font-size: 8.5pt;
          text-align: center;
          font-weight: bold;
        }
        .qr-img {
          display: block;
          margin: 2mm auto;
          width: 42mm;
          height: 42mm;
        }
        .order-id {
          font-family: 'Courier New', monospace;
          font-size: 7.5pt;
          text-align: center;
          letter-spacing: 0.5mm;
          color: #444;
          margin: 1mm 0;
        }
        .apolice {
          font-size: 6.5pt;
          text-align: center;
          color: #555;
          line-height: 1.4;
          margin-top: 2mm;
        }
        .sponsor-row {
          margin-top: 2mm;
        }
        .sponsor-label {
          font-size: 6.5pt;
          text-transform: uppercase;
          letter-spacing: 0.5mm;
          color: #555;
          margin-bottom: 1mm;
        }
        .sponsor-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sponsor-chip-dark {
          background: #1a1a1a;
          border-radius: 1mm;
          padding: 1mm 2mm;
        }
        .sponsor-logo {
          height: 9mm;
          max-width: 40mm;
          object-fit: contain;
          display: block;
          margin: 0 auto;
        }
        .no-print {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: #1a1a1a;
          position: sticky;
          top: 0;
          z-index: 99;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-family: sans-serif;
          cursor: pointer;
          border: none;
          font-weight: 600;
        }
        .btn-primary { background: #c19a5a; color: #000; }
        .btn-ghost { background: transparent; color: #aaa; border: 1px solid #444; }
        .logo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 11mm;
          height: 11mm;
          border: 1px solid #999;
          border-radius: 50%;
          font-size: 5pt;
          font-weight: bold;
          text-align: center;
          line-height: 1.1;
          color: #555;
        }
      `}</style>

      {/* Barra de controle — não impressa */}
      <PrintAutoTrigger />
      <div className="no-print">
        <button className="btn btn-primary" onClick={undefined} id="print-btn">
          Imprimir
        </button>
        <a href="/admin/cortesia" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          ← Voltar
        </a>
        <span style={{ color: "#888", fontSize: "12px", fontFamily: "sans-serif", marginLeft: "8px", alignSelf: "center" }}>
          {printData.length} ingresso{printData.length > 1 ? "s" : ""} · papel 58mm
        </span>
      </div>

      {/* Recibos */}
      {printData.map((ticket, idx) => (
        <div key={ticket.ticketId} className="receipt">

          {/* Logo do clube */}
          <div className="center" style={{ marginBottom: "1mm" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ticket.clubLogoUrl}
              alt={ticket.clubName}
              className="club-logo"
            />
            <div style={{ fontSize: "8pt", fontWeight: "bold", letterSpacing: "1mm", textTransform: "uppercase" }}>
              {ticket.clubName}
            </div>
          </div>

          <hr className="divider" />

          {/* Times */}
          <div className="vs-row">
            {/* Time da casa */}
            <div className="team-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ticket.clubLogoUrl} alt={ticket.clubName} className="team-logo" />
              <div className="team-name">{ticket.clubName}</div>
            </div>

            <div className="vs-label">VS</div>

            {/* Adversário */}
            <div className="team-block">
              {ticket.game.opponentCrestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ticket.game.opponentCrestUrl} alt={ticket.game.opponent} className="team-logo" />
              ) : (
                <div className="logo-placeholder">{ticket.game.opponent.slice(0, 6)}</div>
              )}
              <div className="team-name">{ticket.game.opponent}</div>
            </div>
          </div>

          {/* Infos do jogo */}
          <div className="game-info">
            {ticket.game.competition && <div>{ticket.game.competition}</div>}
            {ticket.game.date && (
              <>
                <div>{fmtDate(ticket.game.date)}</div>
                <div>{fmtTime(ticket.game.date)}</div>
              </>
            )}
            <div>{ticket.game.venue}</div>
          </div>

          <hr className="double-divider" />

          {/* Tipo de ingresso */}
          <div className="ticket-header">Ingresso de Cortesia</div>
          <div className="ticket-type">
            {ticket.typeName}
            {ticket.total > 1 && ` · ${idx + 1}/${ticket.total}`}
          </div>
          {ticket.recipientName !== "Ingresso de Cortesia - Sistema" && (
            <div className="recipient" style={{ marginTop: "1mm" }}>{ticket.recipientName}</div>
          )}

          <hr className="divider" />

          {/* QR Code */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.qrDataUrl} alt="QR Code" className="qr-img" />

          {/* ID do pedido */}
          <div className="order-id">
            ID: {ticket.orderId.slice(0, 8).toUpperCase()}
          </div>

          {/* Patrocínio (opcional) */}
          {ticket.sponsorLogoUrl && (
            <div className="center sponsor-row">
              <div className="sponsor-label">Patrocínio</div>
              <span className={`sponsor-chip${ticket.sponsorLogoTone === "light" ? " sponsor-chip-dark" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.sponsorLogoUrl} alt={ticket.sponsorName ?? "Patrocinador"} className="sponsor-logo" />
              </span>
            </div>
          )}

          <hr className="divider" />

          {/* Apólice */}
          <div className="apolice">
            Apólice 6.063.222<br />
            Chubb Seguros Brasil S.A.
          </div>
        </div>
      ))}
    </>
  );
}
