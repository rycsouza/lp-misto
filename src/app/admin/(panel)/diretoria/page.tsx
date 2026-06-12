import { getAdminBoardMembers, moveBoardMemberUp, moveBoardMemberDown } from "@/app/actions/admin-institutional";
import { BoardMemberActions } from "@/components/admin/BoardMemberActions";
import { ReorderButtons } from "@/components/admin/ReorderButtons";
import Link from "next/link";
import { Plus } from "lucide-react";

const groupLabels: Record<string, string> = {
  executive: "Executiva",
  fiscal: "Conselho Fiscal",
};

const fiscalTypeLabels: Record<string, string> = {
  titular: "Titular",
  suplente: "Suplente",
};

export default async function DiretoriaPage() {
  const members = await getAdminBoardMembers();

  const executive = members.filter((m) => m.group === "executive");
  const fiscal = members.filter((m) => m.group === "fiscal");

  function renderTable(
    items: typeof members,
    groupLabel: string
  ): React.ReactElement {
    return (
      <div key={groupLabel} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{groupLabel}</h3>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Foto
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Nome
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Cargo
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Profissão
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Grupo
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Tipo
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Ordem
                  </th>
                  <th className="text-left text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Ativo
                  </th>
                  <th className="text-right text-muted-foreground text-xs uppercase tracking-wider px-4 py-3">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhum membro cadastrado
                    </td>
                  </tr>
                )}
                {items.map((member, idx) => (
                  <tr
                    key={member.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center">
                        {member.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {member.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {member.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.role}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {member.profession ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {groupLabels[member.group] ?? member.group}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {member.fiscalType
                        ? fiscalTypeLabels[member.fiscalType] ?? member.fiscalType
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      <div className="flex items-center gap-2">
                        <span>{member.order}</span>
                        <ReorderButtons
                          onMoveUp={moveBoardMemberUp.bind(null, member.id)}
                          onMoveDown={moveBoardMemberDown.bind(null, member.id)}
                          isFirst={idx === 0}
                          isLast={idx === items.length - 1}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          member.active
                            ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-600"
                            : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"
                        }
                      >
                        {member.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <BoardMemberActions
                        memberId={member.id}
                        isActive={member.active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground tracking-wide">
          DIRETORIA
        </h2>
        <Link
          href="/admin/diretoria/novo"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Novo Membro
        </Link>
      </div>

      {renderTable(executive, groupLabels.executive)}
      {renderTable(fiscal, groupLabels.fiscal)}
    </div>
  );
}
