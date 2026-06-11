"use client";

import { LogOut } from "lucide-react";
import { adminLogout } from "@/app/actions/admin";

interface AdminHeaderProps {
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="font-display text-xl text-foreground tracking-wider">
        {title}
      </h1>

      <form action={adminLogout}>
        <button
          type="submit"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut size={15} />
          <span>Sair</span>
        </button>
      </form>
    </header>
  );
}
