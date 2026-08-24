"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuote } from "./quote-provider";

/**
 * As três etapas do trabalho: achar, escrever, disparar.
 *
 * Etapas à frente ficam desabilitadas até fazerem sentido — clicar em "Disparar"
 * sem ter escolhido ninguém só levaria a uma tela vazia.
 */

const STEPS = [
  { href: "/", label: "Buscar" },
  { href: "/mensagem", label: "Mensagem" },
  { href: "/enviar", label: "Disparar" },
] as const;

export function StepNav() {
  const pathname = usePathname();
  const { state } = useQuote();

  const enabled = (href: string) => {
    if (href === "/") return true;
    if (href === "/mensagem") return state.selected.length > 0;
    return state.selected.length > 0 && state.template.trim().length > 0;
  };

  return (
    <nav aria-label="Etapas da cotação">
      <ol className="flex items-center gap-1 text-sm">
        {STEPS.map((step, index) => {
          const current = pathname === step.href;
          const available = enabled(step.href);

          return (
            <li key={step.href} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ›
                </span>
              )}
              {available ? (
                <Link
                  href={step.href}
                  aria-current={current ? "step" : undefined}
                  className={`rounded-lg px-2 py-1 ${
                    current
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {step.label}
                </Link>
              ) : (
                <span className="px-2 py-1 text-slate-400 dark:text-slate-600">{step.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
