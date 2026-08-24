"use client";

import { useEffect, useRef, useState } from "react";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";

import "leaflet/dist/leaflet.css";

import type { SearchCenter } from "@/lib/places/types";

/**
 * Escolha da área no mapa: um ponto e um raio.
 *
 * Existe para a região que não tem nome — a orla, o trecho entre duas cidades,
 * um raio de 3 km em volta de onde a pessoa vai ficar. A busca por texto
 * continua ali do lado, intacta; isto é uma segunda porta, não uma troca.
 *
 * Tiles do OpenStreetMap: sem chave de API e sem cadastro de cobrança. Em
 * produção com volume real, o caminho é um provedor de tiles (MapTiler, Carto)
 * — a política de uso dos tiles públicos do OSM não cobre tráfego de produto.
 */

/** Centro do Brasil, para quando não há nada melhor. */
const FALLBACK: SearchCenter = { lat: -15.78, lng: -47.93, radiusKm: 5 };

const RADIUS_STEPS = [1, 2, 3, 5, 10, 15, 20, 30, 50] as const;

interface Props {
  value: SearchCenter | null;
  /**
   * Região digitada no campo ao lado, já localizada.
   *
   * Só move a câmera — não define a área da busca. Quem escolhe a área é o
   * clique no mapa, que é uma decisão explícita; ver a região aparecer só
   * poupa a navegação manual até lá.
   */
  focus?: { lat: number; lng: number; label: string } | null;
  onChange(center: SearchCenter): void;
}

export function MapPicker({ value, focus, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinRef = useRef<CircleMarker | null>(null);
  const circleRef = useRef<Circle | null>(null);
  const focusRef = useRef<CircleMarker | null>(null);
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);

  // `value` é lido dentro do handler de clique, que é registrado uma vez só;
  // a ref mantém o raio atual visível para ele sem recriar o mapa. O valor
  // inicial vem do `useRef`, e as mudanças chegam pelo efeito abaixo.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    // Leaflet toca em `window` ao ser importado, então só carrega no cliente.
    void import("leaflet").then((leaflet) => {
      const L = leaflet.default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start = valueRef.current ?? FALLBACK;
      const map = L.map(containerRef.current, { attributionControl: true }).setView(
        [start.lat, start.lng],
        valueRef.current ? zoomFor(start.radiusKm) : 4,
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Marcador vetorial em vez do pino padrão: o ícone do Leaflet é um PNG
      // resolvido por URL relativa, que quebra sob bundler.
      pinRef.current = L.circleMarker([start.lat, start.lng], {
        radius: 7,
        color: "#047857",
        fillColor: "#059669",
        fillOpacity: 1,
        weight: 2,
      });
      circleRef.current = L.circle([start.lat, start.lng], {
        radius: start.radiusKm * 1_000,
        color: "#059669",
        fillColor: "#059669",
        fillOpacity: 0.12,
        weight: 1,
      });

      if (valueRef.current) {
        pinRef.current.addTo(map);
        circleRef.current.addTo(map);
      }

      map.on("click", (event) => {
        onChange({
          lat: Number(event.latlng.lat.toFixed(5)),
          lng: Number(event.latlng.lng.toFixed(5)),
          radiusKm: valueRef.current?.radiusKm ?? FALLBACK.radiusKm,
        });
      });

      // Marcador da região digitada: oco, para não se confundir com o pino
      // cheio que marca o centro escolhido de fato.
      focusRef.current = L.circleMarker([start.lat, start.lng], {
        radius: 6,
        color: "#0f766e",
        fillOpacity: 0,
        weight: 2,
        dashArray: "3 3",
      });

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pinRef.current = null;
      circleRef.current = null;
      focusRef.current = null;
    };
  }, [onChange]);

  // Reflete no mapa o que mudou por fora dele (clique, slider, geolocalização).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value || !pinRef.current || !circleRef.current) return;

    const position: [number, number] = [value.lat, value.lng];
    pinRef.current.setLatLng(position).addTo(map);
    circleRef.current.setLatLng(position).setRadius(value.radiusKm * 1_000).addTo(map);

    // Enquadra o círculo inteiro: mudar o raio sem reenquadrar deixaria a área
    // escolhida metade fora da tela.
    map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24], maxZoom: 16 });
  }, [value, ready]);

  // Leva a câmera até a região digitada. Roda só quando a região muda, para
  // não puxar o mapa de volta enquanto o usuário arrasta procurando um ponto.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !focusRef.current) return;

    focusRef.current.setLatLng([focus.lat, focus.lng]).addTo(map);
    map.setView([focus.lat, focus.lng], 13);
  }, [focus, ready]);

  function locateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({
          lat: Number(position.coords.latitude.toFixed(5)),
          lng: Number(position.coords.longitude.toFixed(5)),
          radiusKm: value?.radiusKm ?? FALLBACK.radiusKm,
        });
      },
      // Recusar a permissão é resposta válida: o mapa continua clicável.
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  return (
    <div className="grid gap-3">
      <div
        ref={containerRef}
        role="application"
        aria-label="Mapa para escolher o centro da busca"
        className="h-72 w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          {locating ? "Localizando…" : "Usar minha localização"}
        </button>

        <label className="flex flex-1 items-center gap-2 text-sm">
          <span className="whitespace-nowrap">
            Raio: <strong className="tabular-nums">{value?.radiusKm ?? FALLBACK.radiusKm} km</strong>
          </span>
          <input
            type="range"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={RADIUS_STEPS.indexOf(
              (value?.radiusKm ?? FALLBACK.radiusKm) as (typeof RADIUS_STEPS)[number],
            )}
            onChange={(event) =>
              onChange({
                lat: value?.lat ?? FALLBACK.lat,
                lng: value?.lng ?? FALLBACK.lng,
                radiusKm: RADIUS_STEPS[Number(event.target.value)],
              })
            }
            disabled={!value}
            className="min-w-32 flex-1 accent-emerald-600"
            aria-label="Raio da busca em quilômetros"
          />
        </label>
      </div>

      <p className="text-xs text-slate-500">
        {value
          ? "Clique em outro ponto para mover o centro. A busca traz só o que estiver dentro do círculo."
          : focus
            ? `Mostrando ${focus.label.split(",").slice(0, 2).join(",")}. Clique no mapa para marcar o centro da busca.`
            : "Clique no mapa para marcar o centro da busca."}
      </p>
    </div>
  );
}

/** Zoom inicial que faz o círculo caber na altura do mapa. */
function zoomFor(radiusKm: number): number {
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 15) return 11;
  return 10;
}
