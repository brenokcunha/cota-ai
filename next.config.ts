import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem de producao enxuta: o build gera `.next/standalone` com um server.js
  // e so as dependencias que o servidor de fato usa, em vez do node_modules
  // inteiro. Com o Chromium ja pesando 1,3GB, cada camada evitavel conta.
  output: "standalone",

  // Playwright localiza o driver e os browsers por caminho no disco. Se o
  // bundler empacotar o pacote, essa resolução quebra em runtime.
  serverExternalPackages: ["playwright", "playwright-core"],

  // O rastreamento de dependências do build standalone segue `import`, e o
  // Playwright lê arquivos de dados que ninguém importa — `browsers.json`, o
  // binário do driver. Sem isto, a imagem de produção sobe e só quebra na
  // primeira busca, com um "Cannot find module browsers.json".
  outputFileTracingIncludes: {
    "/api/search": ["./node_modules/playwright-core/**/*", "./node_modules/playwright/**/*"],
  },
};

export default nextConfig;
