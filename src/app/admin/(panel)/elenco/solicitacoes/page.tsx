import { getAthleteApplications, getAthleteInviteCode } from "@/app/actions/athletes";
import { AthleteApplicationActions } from "@/components/admin/AthleteApplicationActions";
import { InviteCodeForm } from "./InviteCodeForm";
import Link from "next/link";
import { ChevronLeft, ClipboardList, ExternalLink } from "lucide-react";

const POSITION_LABELS: Record<string, string> = {
  goleiro: "Goleiro", zagueiro: "Zagueiro", lateral: "Lateral",
  volante: "Volante", meia: "Meia", atacante: "Atacante",
};

const FOOT_LABELS: Record<string, string> = {
  direito: "Direito", esquerdo: "Esquerdo", ambidestro: "Ambidestro",
};

const STATUS_CONFIG = {
  pending:  { label: "Pendente",  className: "text-orange-500 bg-orange-500/10" },
  approved: { label: "Aprovado",  className: "text-green-500 bg-green-500/10" },
  rejected: { label: "Rejeitado", className: "text-destructive bg-destructive/10" },
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function AthleteApplicationsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const filterStatus = (status === "approved" || status === "rejected") ? status : undefined;

  const [applications, inviteCode] = await Promise.all([
    getAthleteApplications(filterStatus ?? "pending"),
    getAthleteInviteCode(),
  ]);

  const pendingCount = filterStatus ? null : applications.filter((a) => a.status === "pending").length;
  const publicUrl = `/elenco/cadastro`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/elenco"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <h1 className="font-[family-name:var(--font-bebas-neue)] text-3xl text-foreground">
            Solicitações de Cadastro
          </h1>
          {pendingCount != null && pendingCount > 0 && (
            <span className="text-xs text-orange-500 font-medium">
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-2"
        >
          <ExternalLink size={13} />
          Ver formulário público
        </a>
      </div>

      {/* Invite code config */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Código de acesso</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {inviteCode
              ? "Somente jogadores com este código podem se cadastrar."
              : "Sem código definido — formulário aberto para qualquer pessoa."}
          </p>
        </div>
        <InviteCodeForm current={inviteCode} />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { label: "Pendentes", value: undefined },
          { label: "Aprovados", value: "approved" },
          { label: "Rejeitados", value: "rejected" },
        ].map((tab) => {
          const active = (filterStatus ?? undefined) === tab.value;
          const href = tab.value ? `/admin/elenco/solicitacoes?status=${tab.value}` : "/admin/elenco/solicitacoes";
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {applications.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ClipboardList size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma solicitação aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {applications.map((app) => {
            const statusCfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
            return (
              <div key={app.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{app.fullName}</span>
                      {app.nickname && (
                        <span className="text-xs text-muted-foreground">&ldquo;{app.nickname}&rdquo;</span>
                      )}
                      <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Enviado em {app.createdAt}</p>
                  </div>
                  <AthleteApplicationActions applicationId={app.id} status={app.status} />
                </div>

                {/* Details grid */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                  <Field label="Posição" value={POSITION_LABELS[app.position] ?? app.position} />
                  <Field label="Pé" value={FOOT_LABELS[app.dominantFoot] ?? app.dominantFoot} />
                  <Field label="Peso" value={`${app.weightKg} kg`} />
                  <Field label="Altura" value={`${app.heightCm} cm`} />
                  <Field label="Nascimento" value={app.birthDate} />
                  <Field label="Origem" value={`${app.city} / ${app.state}`} />
                  <Field label="CPF" value={app.cpf} />
                  <Field label="RG" value={app.rg} />
                  <Field label="WhatsApp" value={app.whatsapp} />
                  <Field label="E-mail" value={app.email} />
                  {app.pixKey && <Field label="Chave PIX" value={app.pixKey} />}
                  {app.contractStart && <Field label="Início contrato" value={app.contractStart} />}
                  {app.salaryBrl && <Field label="Salário" value={`R$ ${app.salaryBrl}`} />}
                  {app.rejectionReason && (
                    <div className="col-span-full">
                      <Field label="Motivo rejeição" value={app.rejectionReason} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground font-medium truncate">{value}</p>
    </div>
  );
}
