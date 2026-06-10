import { getSectionEnabled } from "@/lib/config";

interface SectionWrapperProps {
  sectionKey: string;
  children: React.ReactNode;
}

export default async function SectionWrapper({ sectionKey, children }: SectionWrapperProps) {
  const enabled = await getSectionEnabled(sectionKey);
  if (!enabled) return null;
  return <>{children}</>;
}
