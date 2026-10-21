import { getSectionEnabled } from "@/lib/config";

/** Rótulo personalizado da seção (configurado pelo clube). Vazio/undefined = título padrão do componente. */
export interface SectionLabelProps {
  label?: string;
}

interface SectionWrapperProps {
  sectionKey: string;
  children: React.ReactNode;
}

export default async function SectionWrapper({ sectionKey, children }: SectionWrapperProps) {
  const enabled = await getSectionEnabled(sectionKey);
  if (!enabled) return null;
  return <>{children}</>;
}
