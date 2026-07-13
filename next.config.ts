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
          // Content-Security-Policy é definido por requisição no proxy.ts (nonce +
          // strict-dynamic). Não pode ficar aqui: o nonce muda a cada request.
        ],
      },
    ];
  },
};

const analyze = process.env.ANALYZE === "true";

export default analyze ? withBundleAnalyzer({})(nextConfig) : nextConfig;
