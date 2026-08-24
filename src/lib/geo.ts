/** Contas de mapa: distância entre pontos e zoom equivalente a um raio. */

const EARTH_RADIUS_KM = 6_371;

/**
 * Distância em linha reta entre dois pontos, em km (Haversine).
 *
 * É o que decide se um estabelecimento está dentro do raio pedido. O Google
 * devolve o que ele acha relevante para a região da tela, não o que cabe num
 * círculo — o recorte exato é feito aqui.
 */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Zoom do Google Maps que enquadra, aproximadamente, um raio em km.
 *
 * A URL de busca do Maps aceita `@lat,lng,Nz`, e o zoom é o único jeito de
 * dizer "procure por aqui perto" sem API paga. Aproximado de propósito: o
 * Google não promete respeitar o enquadramento, e quem garante o raio de
 * verdade é o filtro por distância. Zoom menor que o ideal traz resultado
 * demais (que é filtrado); zoom maior perderia estabelecimento válido.
 */
export function zoomForRadiusKm(radiusKm: number, lat: number): number {
  // Metros por pixel no equador, no zoom 0, para tiles de 256px.
  const METERS_PER_PIXEL_AT_ZOOM_0 = 156_543.03;
  // Metade da largura útil da janela do mapa do Google, em pixels.
  const HALF_VIEWPORT_PX = 640;

  const metersPerPixel = (radiusKm * 1_000) / HALF_VIEWPORT_PX;
  const zoom = Math.log2(
    (METERS_PER_PIXEL_AT_ZOOM_0 * Math.cos(toRad(lat))) / metersPerPixel,
  );

  // Fora de [10, 17] o Maps ou mostra o país inteiro, ou uma esquina.
  return Math.min(17, Math.max(10, Math.round(zoom)));
}
