// Bancos y billeteras de Honduras para pagar por transferencia.
// Una página web no puede abrir la app de un banco en la pantalla de transferir: se enlaza a la ficha
// de la app en Play Store o App Store, que muestra «Abrir» si el cliente ya la tiene instalada.
// Identificadores tomados de los enlaces de Play Store y App Store (nombre de la app y banco a la vista), nov. 2026.
// Si un banco cambia de app, se corrige aquí. Los colores son decorativos, no los oficiales de cada banco.

export type Banco = {
  clave: string;
  nombre: string;
  corto: string;
  sigla?: string;
  color: string;
  android: string | null; // paquete de Play Store
  ios: string | null; // número de App Store
  web: string | null;
  billetera?: boolean;
};

export const BANCOS: Banco[] = [
  { clave: 'atlantida', nombre: 'Banco Atlántida', corto: 'Atlántida', sigla: 'AT', color: '#b91c1c', android: 'com.atlantida.bda', ios: '6749024321', web: 'https://www.bancatlan.hn' },
  { clave: 'banpais', nombre: 'Banpaís', corto: 'Banpaís', sigla: 'BP', color: '#1d4ed8', android: 'hn.com.bi.banpais', ios: '1019342453', web: 'https://www.banpais.hn' },
  { clave: 'bac', nombre: 'BAC Credomatic', corto: 'BAC', sigla: 'BAC', color: '#be123c', android: 'net.bac.sbe.android', ios: '465508552', web: 'https://www.baccredomatic.com/es-hn' },
  { clave: 'ficohsa', nombre: 'Banco Ficohsa', corto: 'Ficohsa', sigla: 'FI', color: '#1e40af', android: 'com.ficohsa.activities', ios: '474591239', web: 'https://www.ficohsa.com/hn/' },
  { clave: 'occidente', nombre: 'Banco de Occidente', corto: 'Occidente', sigla: 'OC', color: '#047857', android: 'com.todomovil.occidentemovil3', ios: '777458975', web: 'https://www.bancodeoccidente.hn' },
  { clave: 'banrural', nombre: 'Banrural Honduras', corto: 'Banrural', sigla: 'BR', color: '#15803d', android: 'com.soteica.brmovil.app', ios: '6468330308', web: 'https://www.banrural.com.hn' },
  { clave: 'davivienda', nombre: 'Davivienda Honduras', corto: 'Davivienda', sigla: 'DV', color: '#c2410c', android: 'com.todo1.davivienda.mobileapp.hn', ios: '1148049341', web: 'https://www.davivienda.com.hn' },
  { clave: 'lafise', nombre: 'Banco LAFISE', corto: 'LAFISE', sigla: 'LF', color: '#0f766e', android: 'com.lafise.lafiseone', ios: '6575295212', web: 'https://www.lafise.com/blh/' },
  { clave: 'promerica', nombre: 'Banco Promerica', corto: 'Promerica', sigla: 'PR', color: '#4d7c0f', android: 'com.soteica.pmmovil.app', ios: '1550489214', web: 'https://www.bancopromerica.com' },
  { clave: 'azteca', nombre: 'Banco Azteca', corto: 'Azteca', sigla: 'AZ', color: '#166534', android: 'hn.com.bancoazteca.gsbdbancoazteca', ios: '6475891967', web: 'https://www.bancoazteca.com.hn' },
  { clave: 'popular', nombre: 'Banco Popular', corto: 'Popular', sigla: 'PO', color: '#6d28d9', android: 'com.bancopopular.bpopularmovil', ios: '6449749240', web: 'https://www.bancopopular.hn' },
  { clave: 'cuscatlan', nombre: 'Banco Cuscatlán', corto: 'Cuscatlán', sigla: 'CU', color: '#0e7490', android: 'com.bancocuscatlanhn.cuscatlanmovilprd', ios: '6741618453', web: 'https://www.bancocuscatlan.com' },
  { clave: 'banhcafe', nombre: 'Banhcafé', corto: 'Banhcafé', sigla: 'BH', color: '#854d0e', android: 'com.jmacbhc.BANHCAFEMobileApp', ios: '6449547967', web: 'https://www.banhcafe.hn' },
  { clave: 'ficensa', nombre: 'Banco Ficensa', corto: 'Ficensa', sigla: 'FC', color: '#4338ca', android: 'com.soteica.ficensamovil.app', ios: '1456180337', web: 'https://www.ficensa.com' },
  // Billeteras: se transfiere a un número de celular
  { clave: 'tigo_money', nombre: 'Tigo Money', corto: 'Tigo Money', sigla: 'TM', color: '#1e3a8a', android: 'hn.tigo.mfsapp', ios: '943041659', web: 'https://www.tigo.com.hn/tigo-money', billetera: true },
  { clave: 'tengo', nombre: 'TENGO', corto: 'TENGO', sigla: 'TG', color: '#a21caf', android: 'com.tengohonduras.appastra', ios: '962381914', web: 'https://www.tengo.hn', billetera: true },
  { clave: 'dilo', nombre: 'Dilo', corto: 'Dilo', sigla: 'DI', color: '#9a3412', android: 'com.idmission.dilo', ios: '1550903248', web: 'https://www.dilo.hn', billetera: true },
];

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
export function iniciales(b: Banco) {
  if (b.sigla) return b.sigla;
  const p = b.corto.replace(/^Banco\s+(de\s+)?/i, '').split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p.map((x) => x[0]).join('') : (p[0] ?? '?').slice(0, 2)).slice(0, 3).toUpperCase();
}

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
