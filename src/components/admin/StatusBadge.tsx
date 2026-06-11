import { cn } from "@/lib/utils";

type StatusType =
  | "pending"
  | "paid"
  | "cancelled"
  | "refunded"
  | "failed"
  | string;

interface StatusBadgeProps {
  status: StatusType;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendente",
    className: "bg-amber-500/15 text-amber-500",
  },
  paid: {
    label: "Pago",
    className: "bg-green-500/15 text-green-600",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/15 text-destructive",
  },
  failed: {
    label: "Falhou",
    className: "bg-destructive/15 text-destructive",
  },
  refunded: {
    label: "Reembolsado",
    className: "bg-blue-500/15 text-blue-500",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
