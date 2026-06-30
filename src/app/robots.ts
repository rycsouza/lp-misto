import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/base-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getAppBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
