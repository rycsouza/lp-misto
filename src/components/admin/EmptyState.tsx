import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  href: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Ação primária — normalmente "criar o primeiro X". */
  action?: EmptyStateAction;
  /** Ação secundária discreta — ex.: "limpar filtro". */
  secondary?: EmptyStateAction;
  className?: string;
}

/**
 * Estado vazio acionável, padrão do painel. Em vez de só "Nenhum X",
 * explica em uma linha e oferece o próximo passo — chave para o clube
 * novo se virar sozinho.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center px-6 py-12 ${className}`}>
      <span className="w-14 h-14 rounded-full bg-secondary/60 flex items-center justify-center mb-4">
        <Icon size={26} className="text-muted-foreground/70" />
      </span>
      <p className="text-foreground font-semibold text-sm">{title}</p>
      {description && (
        <p className="text-muted-foreground text-sm mt-1 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondary) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex items-center rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
