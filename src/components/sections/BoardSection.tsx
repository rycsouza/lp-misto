import { getActiveBoardMembers, getActiveAccountabilityReports } from "@/lib/db/queries";
import SectionWrapper from "@/components/ui/section-wrapper";
import { Avatar } from "@/components/ui/avatar";
import { FileText, Download } from "lucide-react";
import { toDownloadUrl } from "@/lib/cloudinary-download";

async function BoardSectionContent() {
  const [members, reports] = await Promise.all([
    getActiveBoardMembers().catch(() => []),
    getActiveAccountabilityReports().catch(() => []),
  ]);
  const executive = members.filter((m) => m.group === "executive");
  const fiscalTitular = members.filter((m) => m.group === "fiscal" && m.fiscalType === "titular");
  const fiscalSuplente = members.filter(
    (m) => m.group === "fiscal" && m.fiscalType === "suplente"
  );

  return (
    <section id="diretoria" className="py-16 bg-card/30 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-primary text-sm font-semibold tracking-widest uppercase text-center mb-2">
          Gestão
        </p>
        <h2 className="font-[family-name:var(--font-bebas-neue)] text-4xl text-center text-foreground mb-10">
          Diretoria
        </h2>

        {executive.length > 0 && (
          <div className="mb-12">
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-6 border-b border-border pb-2">
              Diretoria Executiva
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {executive.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}

        {(fiscalTitular.length > 0 || fiscalSuplente.length > 0) && (
          <div>
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-6 border-b border-border pb-2">
              Conselho Fiscal
            </h3>
            {fiscalTitular.length > 0 && (
              <div className="mb-8">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Titulares</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {fiscalTitular.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}
            {fiscalSuplente.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Suplentes</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {fiscalSuplente.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prestação de contas — transparência financeira */}
        {reports.length > 0 && (
          <div id="prestacao-contas" className="mt-12 scroll-mt-20">
            <h3 className="font-[family-name:var(--font-bebas-neue)] text-2xl text-primary mb-6 border-b border-border pb-2">
              Prestação de Contas
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.map((r) => (
                <li key={r.id}>
                  <a
                    href={toDownloadUrl(r.fileUrl, r.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(193,154,90,0.25)] transition-all"
                  >
                    <span className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText size={18} className="text-primary" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{r.title}</span>
                      <span className="text-xs text-muted-foreground">PDF</span>
                    </span>
                    <Download size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function MemberCard({
  member,
}: {
  member: {
    id: string;
    name: string;
    role: string;
    profession?: string | null;
    photoUrl?: string | null;
  };
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-3 text-center hover:shadow-[0_0_15px_rgba(193,154,90,0.4)] transition-all">
      <Avatar name={member.name} photoUrl={member.photoUrl} size={72} />
      <div>
        <p className="font-semibold text-sm text-foreground leading-tight">{member.name}</p>
        <p className="text-xs text-primary mt-0.5">{member.role}</p>
        {member.profession && (
          <p className="text-xs text-muted-foreground mt-0.5">{member.profession}</p>
        )}
      </div>
    </div>
  );
}

export default async function BoardSection() {
  return (
    <SectionWrapper sectionKey="board">
      <BoardSectionContent />
    </SectionWrapper>
  );
}
