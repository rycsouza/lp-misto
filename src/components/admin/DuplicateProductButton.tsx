"use client";

import { useTransition } from "react";
import { duplicateProduct } from "@/app/actions/admin-shop";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

interface Props {
  productId: string;
}

export function DuplicateProductButton({ productId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await duplicateProduct(productId);
      if (result.success && result.id) {
        router.push(`/admin/loja/${result.id}`);
      }
    });
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={isPending}
      title="Duplicar produto"
      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      <Copy size={13} />
    </button>
  );
}
