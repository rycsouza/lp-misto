import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  transpilePackages: ["@uiw/react-md-editor", "@uiw/react-markdown-preview"],
  images: {
    // Allow any HTTPS host so image URLs stored in the DB work without config changes.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    // Custo/otimização (Vercel free tier):
    // - minimumCacheTTL alto: imagem otimizada fica ~31 dias em cache antes de
    //   re-otimizar → menos transformações cobradas (imagens do clube mudam pouco).
    // - só webp: evita gerar avif também (2x transformações + avif é mais caro de codificar).
    minimumCacheTTL: 2_678_400, // 31 dias
    formats: ["image/webp"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // camera=(self) libera o leitor de QR da validação de ingressos
            // na própria origem; microfone e geolocalização seguem bloqueados.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-eval required by React dev mode; MercadoPago SDK loaded from CDN.
              // 'unsafe-inline' segue necessário sem nonce (bootstrap de hidratação do Next);
              // migrar para nonce+strict-dynamic exige render dinâmico em tudo (ver proxy.ts).
              `script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              // só https (remotePatterns já é https-only) — sem http: para evitar mixed-content
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              // MP.js makes API calls to MercadoPago for BIN lookup, installments and tokenization
              "connect-src 'self' https://api.mercadopago.com https://events.mercadopago.com",
              // hardening: sem plugins, sem sequestro de <base>, forms só na própria origem
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              // upgrade http→https só em produção (em dev quebraria o localhost http)
              ...(process.env.NODE_ENV === "development" ? [] : ["upgrade-insecure-requests"]),
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const analyze = process.env.ANALYZE === "true";

export default analyze ? withBundleAnalyzer({})(nextConfig) : nextConfig;
