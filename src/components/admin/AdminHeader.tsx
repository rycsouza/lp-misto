"use client";

import { LogOut } from "lucide-react";
import { adminLogout } from "@/app/actions/admin-auth";

interface AdminHeaderProps {
  title: string;
  userName: string;
  userRole: "admin" | "editor";
}

export function AdminHeader({ title, userName, userRole }: AdminHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="font-display text-xl text-foreground tracking-wider">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
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

        <form action={adminLogout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut size={15} />
            <span>Sair</span>
          </button>
        </form>
      </div>
    </header>
  );
}
