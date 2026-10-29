import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dev server do Next 16 recusa requisicoes cross-origin aos assets de
  // desenvolvimento. Sem isto, expor `npm run dev` por um tunel (Cloudflare,
  // ngrok) serve a pagina mas quebra os assets, com erro que nao menciona
  // origem. So vale em desenvolvimento; producao ignora esta chave.
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Playwright localiza o driver e os browsers por caminho no disco. Se o
  // bundler empacotar o pacote, essa resolução quebra em runtime.
  serverExternalPackages: ["playwright", "playwright-core"],

  // Cabeçalhos de defesa em profundidade. Sem CSP de scripts de propósito: o
  // Next injeta scripts inline e uma política restrita exigiria nonce por
  // requisição; o que entra aqui não quebra nada e fecha clickjacking e
  // sniffing de tipo.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // `geolocation` fica liberado: o mapa usa "minha localização".
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
