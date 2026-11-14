export type Env = {
  DB: D1Database;
  ARCHIVOS?: R2Bucket;
  ENTORNO: string;
  ORIGEN_WEB: string;
  RP_ID: string;
  OWNER_EMAIL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_PLANTILLA?: string;
  TURNSTILE_SECRET?: string;
  WA_TOKEN?: string;
  WA_PHONE_ID?: string;
  WA_VERIFY_TOKEN?: string;
  WA_APP_SECRET?: string;
  WA_PLANTILLA_RECORDATORIO?: string;
  WEB_URL?: string;
  WA_PLANTILLA_PERSONAL?: string;
};

// Honduras: UTC-6 todo el año
const DESFASE_MS = -6 * 3600e3;
export const utc = () => new Date().toISOString();
export const ahoraLocal = () => new Date(Date.now() + DESFASE_MS).toISOString().slice(0, 16);
export const sumarMin = (local: string, min: number) =>
  new Date(Date.parse(local + ':00Z') + min * 60e3).toISOString().slice(0, 16);
export const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(fecha + 'T00:00:00Z') + dias * 864e5).toISOString().slice(0, 10);
export const diaSemana = (fecha: string) => new Date(fecha + 'T00:00:00Z').getUTCDay();
export const minutosEntre = (a: string, b: string) =>
  Math.round((Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 60e3);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function hora12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}
export function fechaTexto(local: string) {
  const f = local.slice(0, 10);
  const hoy = ahoraLocal().slice(0, 10);
  const dia = f === hoy ? 'hoy' : f === sumarDias(hoy, 1) ? 'mañana'
    : `${DIAS[diaSemana(f)]} ${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
  return `${dia} a las ${hora12(local.slice(11))}`;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export async function sha256(t: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
}
export function aleatorioHex(bytes = 32) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer);
}
export async function hashPin(pin: string, sal = aleatorioHex(8)) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: 50000 }, clave, 256);
  return `${sal}:${hex(bits)}`;
}
export async function pinValido(pin: string, guardado: string) {
  return (await hashPin(pin, guardado.split(':')[0])) === guardado;
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function codigoCorto(n = 5) {
  return [...crypto.getRandomValues(new Uint8Array(n))].map((b) => ALFABETO[b % ALFABETO.length]).join('');
}
export const RE_CODIGO = /\b[A-HJKMNP-Z2-9]{5}\b/;

export function nombrePublico(nombre: string) {
  const p = nombre.trim().split(/\s+/);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return p.length > 1 ? `${cap(p[0])} ${p[1].charAt(0).toUpperCase()}.` : cap(p[0]);
}
/** Devuelve el teléfono solo con dígitos y prefijo 504, o null si no es válido. */
export function normalizarTel(t?: string | null) {
  if (!t) return null;
  const d = t.replace(/\D/g, '');
  if (d.length === 8) return '504' + d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

export const ESTADOS_VIVOS = `('agendada','en_atencion','terminada')`;

/** Horas del día con los barberos que las tienen libres. */
export async function disponibilidad(env: Env, fecha: string, opts: { sinAnticipacion?: boolean } = {}) {
  const b = await env.DB.prepare('SELECT * FROM barberia WHERE id = 1').first<any>();
  const hoy = ahoraLocal();
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return [];
  if (fecha < hoy.slice(0, 10) || fecha > sumarDias(hoy.slice(0, 10), b.dias_anticipacion)) return [];
  const rango = JSON.parse(b.horario)[String(diaSemana(fecha))] as [string, string] | null;
  if (!rango) return [];
  const barberos = (await env.DB.prepare('SELECT id FROM barberos WHERE activo = 1 AND atiende = 1 ORDER BY orden, id').all<any>()).results;
  const ocupadas = (await env.DB.prepare(
    `SELECT barbero_id, inicio FROM citas WHERE inicio LIKE ?1 AND estado IN ${ESTADOS_VIVOS}
     UNION SELECT barbero_id, inicio FROM bloqueos WHERE inicio LIKE ?1`).bind(fecha + '%').all<any>()).results;
  const tomado = new Set(ocupadas.map((o) => `${o.barbero_id}|${o.inicio}`));
  const horas: { inicio: string; hora: string; barberos: number[] }[] = [];
  const cierre = `${fecha}T${rango[1]}`;
  const alm = b.almuerzo ? (JSON.parse(b.almuerzo) as [string, string]) : null;
  // El cliente reserva con anticipación mínima; el personal puede agregar hasta el último minuto
  const desde = sumarMin(hoy, opts.sinAnticipacion ? 0 : b.anticipacion_min);
  for (let t = `${fecha}T${rango[0]}`; sumarMin(t, b.duracion_cita_min) <= cierre; t = sumarMin(t, b.duracion_cita_min)) {
    const fin = sumarMin(t, b.duracion_cita_min);
    if (alm && t < `${fecha}T${alm[1]}` && fin > `${fecha}T${alm[0]}`) continue; // hora de almuerzo
    const libres = t > hoy && t >= desde ? barberos.filter((x) => !tomado.has(`${x.id}|${t}`)).map((x) => x.id) : [];
    horas.push({ inicio: t, hora: t.slice(11), barberos: libres });
  }
  return horas;
}
