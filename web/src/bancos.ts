// Bancos y billeteras de Honduras para pagar por transferencia.
// Una página web no puede abrir la app de un banco en la pantalla de transferir: se enlaza a la ficha
// de la app en Play Store o App Store, que muestra «Abrir» si el cliente ya la tiene instalada.
// Los identificadores de las tiendas se verificaron en la ficha de cada app; null = no se pudo verificar.

export type Banco = {
  clave: string;
  nombre: string;
  corto: string;
  color: string;
  android: string | null; // paquete de Play Store
  ios: string | null; // número de App Store
  web: string | null;
  billetera?: boolean;
};

export const BANCOS: Banco[] = [];

export const OTRO = 'otro';

export function bancoDe(clave: string, nombreLibre?: string): Banco {
  return BANCOS.find((b) => b.clave === clave)
    ?? { clave: OTRO, nombre: nombreLibre || 'Banco', corto: nombreLibre || 'Banco', color: '#4b5563', android: null, ios: null, web: null };
}

const esIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esAndroid = () => /Android/i.test(navigator.userAgent);

/** Enlace para abrir la app del banco en este teléfono (ficha de la tienda) o, si no hay, su sitio web. */
export function enlaceApp(b: Banco): string | null {
  if (esIOS() && b.ios) return `https://apps.apple.com/hn/app/id${b.ios}`;
  if (esAndroid() && b.android) return `https://play.google.com/store/apps/details?id=${b.android}`;
  return b.web;
}

/** Iniciales para el sello de color del banco. */
export const iniciales = (b: Banco) => b.corto.replace(/^Banco\s+/i, '').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

export type Cuenta = {
  id: string; banco: string; banco_nombre: string; tipo: 'ahorro' | 'cheques' | 'billetera'; moneda: 'HNL' | 'USD';
  numero: string; titular: string; nota: string; activa: boolean;
};

export const TIPOS: Record<Cuenta['tipo'], string> = { ahorro: 'Cuenta de ahorro', cheques: 'Cuenta de cheques', billetera: 'Billetera móvil' };
export const MONEDAS: Record<Cuenta['moneda'], string> = { HNL: 'Lempiras', USD: 'Dólares' };

/** Cuentas visibles. La API anterior devuelve el texto JSON sin filtrar. */
export function cuentasDe(b: any): Cuenta[] {
  let l = b?.cuentas;
  if (typeof l === 'string') { try { l = JSON.parse(l); } catch { l = []; } }
  return Array.isArray(l) ? l.filter((x: Cuenta) => x && x.activa !== false && x.numero) : [];
}

/** Copia al portapapeles; con respaldo para navegadores que no dejan usar la API moderna. */
export async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* respaldo abajo */ }
  const t = document.createElement('textarea');
  t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select(); t.setSelectionRange(0, texto.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  t.remove();
  return ok;
}
