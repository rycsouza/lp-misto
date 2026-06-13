"use client";

import { LogOut } from "lucide-react";
import { adminLogout } from "@/app/actions/admin-auth";

interface AdminHeaderProps {
  title: string;
  userName: string;
  userRole: "admin" | "editor";
}

export function AdminHeader({ title, userName, userRole }: AdminHeaderProps) {
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <h1 className="font-display text-lg md:text-xl text-foreground tracking-wider truncate">
        {title}
      </h1>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Desktop: full name + role badge */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Olá, <span className="text-foreground font-medium">{userName}</span>
          </span>
          <span
            className={
              userRole === "admin"
                ? "text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase tracking-wider"
                : "text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium uppercase tracking-wider"
            }
          >
            {userRole}
          </span>
        </div>

        {/* Mobile: avatar with initials */}
        <div
          className={`flex md:hidden w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
            userRole === "admin"
              ? "bg-primary/20 text-primary"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {initials}
        </div>

        <form action={adminLogout}>
          <button
            type="submit"
            title="Sair"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors p-1 md:p-0 rounded"
          >
            <LogOut size={15} />
            <span className="hidden md:inline">Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
