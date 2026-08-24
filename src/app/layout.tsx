import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import { QuoteProvider } from "@/components/quote-provider";
import { StepNav } from "@/components/step-nav";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "cota-ai — cote com vários estabelecimentos pelo WhatsApp",
  description:
    "Busque estabelecimentos de uma região, selecione os que interessam e dispare a mesma mensagem para todos pelo seu WhatsApp.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {/* O provider envolve tudo: as três etapas são a mesma cotação, e o
            usuário vai e volta entre elas o tempo todo. */}
        <QuoteProvider>
          <header className="border-b border-slate-200 dark:border-slate-800">
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                cota<span className="text-emerald-600">-ai</span>
              </Link>
              <StepNav />
            </div>
          </header>

          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>

          <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 dark:border-slate-800">
            O cota-ai não envia mensagens sozinho: ele monta a mensagem e você confirma cada envio no
            seu WhatsApp.
          </footer>
        </QuoteProvider>
      </body>
    </html>
  );
}
