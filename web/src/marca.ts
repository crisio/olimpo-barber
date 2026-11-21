// Nombre y logo del negocio. Se guardan en el navegador para pintar el encabezado al instante
// y se actualizan desde la API; el dueño los cambia en Configuración → Logo y nombre.
import { useEffect, useSyncExternalStore } from 'react';
import { API, api, memoria } from './api';

export type Marca = {
  nombre: string;
  marca_titulo: string;
  marca_subtitulo: string;
  logo_key: string | null;
  logo_con_texto: number;
};

export const MARCA_ORIGINAL: Marca = {
  nombre: 'Olimpo Barber Club', marca_titulo: 'OLIMPO', marca_subtitulo: 'BARBER CLUB', logo_key: null, logo_con_texto: 1,
};

/** Dirección de una imagen guardada. En la demostración la clave ya es la imagen (data:). */
export const urlArchivo = (clave: string | null | undefined) =>
  !clave ? null : clave.startsWith('data:') ? clave : `${API}/api/archivos/${clave}`;

/** Normaliza lo que venga de la API (las columnas nuevas pueden faltar si la API es anterior). */
export function aMarca(b: any): Marca {
  if (!b?.nombre) return MARCA_ORIGINAL;
  const viejo = b.marca_titulo === undefined; // API anterior a la configuración de marca
  return {
    nombre: b.nombre,
    marca_titulo: viejo ? MARCA_ORIGINAL.marca_titulo : b.marca_titulo ?? '',
    marca_subtitulo: viejo ? MARCA_ORIGINAL.marca_subtitulo : b.marca_subtitulo ?? '',
    logo_key: b.logo_key ?? null,
    logo_con_texto: b.logo_con_texto ?? 1,
  };
}

function leerGuardada(): Marca | null {
  try { const m = JSON.parse(memoria.leer('ty_marca') ?? 'null'); return m?.nombre ? m : null; } catch { return null; }
}

let actual: Marca = leerGuardada() ?? MARCA_ORIGINAL;
let pedida = false;
const oyentes = new Set<() => void>();

function aplicarAlDocumento(m: Marca) {
  document.title = `${m.nombre} · Citas`;
  const logo = urlArchivo(m.logo_key);
  for (const sel of ['link[rel="icon"]', 'link[rel="apple-touch-icon"]']) {
    const el = document.querySelector<HTMLLinkElement>(sel);
    if (!el) continue;
    if (!el.dataset.original) el.dataset.original = el.getAttribute('href') ?? '';
    el.href = logo ?? el.dataset.original;
    if (el.rel === 'icon') el.type = logo ? '' : 'image/svg+xml';
  }
}

export function ponerMarca(m: Marca) {
  actual = m;
  memoria.guardar('ty_marca', JSON.stringify(m));
  aplicarAlDocumento(m);
  oyentes.forEach((f) => f());
}

/** Vuelve a leer nombre y logo de la API (por ejemplo, después de guardar en Configuración). */
export async function refrescarMarca() {
  pedida = true;
  try {
    ponerMarca(aMarca(await api('/marca')));
  } catch {
    // API anterior sin /marca: se toma de los datos públicos de la barbería
    try { ponerMarca(aMarca((await api<any>('/barberia')).barberia)); } catch { /* sin conexión: queda lo guardado */ }
  }
}

export function useMarca() {
  useEffect(() => { if (!pedida) { aplicarAlDocumento(actual); refrescarMarca(); } }, []);
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => actual);
}
