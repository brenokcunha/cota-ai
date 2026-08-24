# Imagem oficial do Playwright: já traz o Chromium e as bibliotecas de sistema
# que ele precisa, que é a parte chata de instalar à mão.
#
# A tag TEM QUE acompanhar a versão de `playwright` no package.json. Versões
# diferentes fazem o Playwright procurar um browser que não está na imagem.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
# Os browsers já vêm na imagem (em /ms-playwright); baixar de novo só engorda.
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

# Alvo de desenvolvimento: o compose monta o código por cima deste COPY, que
# existe para a imagem também rodar sozinha, sem bind mount.
FROM deps AS dev
COPY . .
EXPOSE 3000
# `sh` explicito: o bit de execucao nao sobrevive a um checkout no Windows.
ENTRYPOINT ["sh", "/app/docker/dev-entrypoint.sh"]
CMD ["npm", "run", "dev"]
