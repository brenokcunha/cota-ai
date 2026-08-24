import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright localiza o driver e os browsers por caminho no disco. Se o
  // bundler empacotar o pacote, essa resolução quebra em runtime.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
