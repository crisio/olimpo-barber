export const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ErrorApi extends Error {
  constructor(mensaje: string, public estado: number, public datos: any) { super(mensaje); }
}
export const token = {
  leer: () => { try { return localStorage.getItem('ty_token'); } catch { return null; } },
  guardar: (t: string | null) => { try { t ? localStorage.setItem('ty_token', t) : localStorage.removeItem('ty_token'); } catch { /* sin almacenamiento */ } },
};
export async function api<T = any>(ruta: string, cuerpo?: unknown, metodo?: string): Promise<T> {
  const t = token.leer();
  let r: Response;
  try {
    r = await fetch(`${API}/api${ruta}`, {
      method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
      headers: { ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch { throw new ErrorApi('Sin conexión. Revisa tu internet.', 0, null); }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(datos?.error ?? 'Algo salió mal.', r.status, datos);
  return datos as T;
}

export const memoria = {
  leer: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  guardar: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* nada */ } },
};
export function dispositivo() {
  let d = memoria.leer('ty_disp');
  if (!d) { d = crypto.randomUUID(); memoria.guardar('ty_disp', d); }
  return d;
}

// ---- Formato ----
export const L = (n: number) => `L ${n}`;
export function hora12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const sumarDias = (f: string, d: number) => new Date(Date.parse(f + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
export const diaSemana = (f: string) => new Date(f + 'T00:00:00Z').getUTCDay();
export const minutosEntre = (a: string, b: string) => Math.round((Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 60e3);
export function diaTexto(fecha: string, hoy: string, corto = false) {
  if (fecha === hoy) return 'hoy';
  if (fecha === sumarDias(hoy, 1)) return 'mañana';
  return `${(corto ? DIAS_C : DIAS)[diaSemana(fecha)]} ${Number(fecha.slice(8))} ${MESES[Number(fecha.slice(5, 7)) - 1]}`;
}
export const cuandoTexto = (inicio: string, ahora: string) => `${diaTexto(inicio.slice(0, 10), ahora.slice(0, 10))} · ${hora12(inicio.slice(11))}`;
export function duracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h >= 24) { const d = Math.floor(h / 24); return d === 1 ? '1 día' : `${d} días`; }
  return m ? `${h} h ${m} min` : `${h} h`;
}
export const diaCorto = (f: string) => ({ dia: DIAS_C[diaSemana(f)], num: Number(f.slice(8)) });
