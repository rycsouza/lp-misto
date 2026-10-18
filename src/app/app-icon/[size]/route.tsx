import { ImageResponse } from "next/og";
import { getSiteConfig } from "@/lib/config";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import {
  APP_ICON_SPECS,
  appIconForeground,
  appIconInitials,
  appTheme,
  parseAppIconKind,
} from "@/lib/pwa/icons";

/** Geração é CPU (satori/resvg) e a rota é pública: limite por IP (fail-open sem Redis). */
const ICON_RATE_LIMIT = 120;
const ICON_RATE_WINDOW_SEC = 60;

/**
 * Ícone de fallback do app: iniciais do clube sobre a cor primária. Usado quando o
 * logo não é um upload do projeto no Cloudinary. Tamanho em lista fechada; o clube
 * vem do host (proxy), nunca de parâmetro do cliente.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const kind = parseAppIconKind(size);
  if (!kind) {
    return new Response("Not found", { status: 404 });
  }

  const limit = await rateLimit(`rl:app-icon:${await getClientIp()}`, ICON_RATE_LIMIT, ICON_RATE_WINDOW_SEC);
  if (!limit.ok) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(ICON_RATE_WINDOW_SEC) } });
  }

  const config = await getSiteConfig().catch(() => null);
  const { theme } = appTheme(config);
  const spec = APP_ICON_SPECS[kind];
  const initials = appIconInitials(config?.siteName);
  const fontSize = Math.round(spec.px * (spec.maskable ? 0.32 : 0.4));

  try {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: theme,
            color: appIconForeground(theme),
            fontSize,
            letterSpacing: "-0.02em",
          }}
        >
          {initials}
        </div>
      ),
      {
        width: spec.px,
        height: spec.px,
        headers: { "Cache-Control": "public, max-age=3600" },
      },
    );
  } catch (err) {
    console.error("app-icon generation error:", err);
    return new Response("Erro ao gerar ícone.", { status: 500 });
  }
}
