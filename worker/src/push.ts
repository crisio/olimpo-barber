import { buildPushPayload } from '@block65/webcrypto-web-push';
import { Env, utc, fechaTexto, nombreNegocio } from './lib';
import { enviarWA } from './whatsapp';

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Par de claves VAPID. Se genera una sola vez y se guarda en D1, así no hay que configurar nada a mano. */
export async function clavesVapid(env: Env) {
  const fila = await env.DB.prepare(`SELECT valor FROM claves WHERE nombre = 'vapid'`).first<any>();
  if (fila) return JSON.parse(fila.valor) as { publicKey: string; privateKey: string };
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', par.privateKey)) as JsonWebKey;
  const punto = new Uint8Array(65);
  punto[0] = 4; punto.set(deB64url(jwk.x!), 1); punto.set(deB64url(jwk.y!), 33);
  const claves = { publicKey: b64url(punto), privateKey: jwk.d! };
  await env.DB.prepare(`INSERT OR IGNORE INTO claves (nombre, valor) VALUES ('vapid', ?)`).bind(JSON.stringify(claves)).run();
  // Si dos peticiones la crearon a la vez, gana la que quedó guardada
  return JSON.parse((await env.DB.prepare(`SELECT valor FROM claves WHERE nombre = 'vapid'`).first<any>()).valor);
}

export type Aviso = { titulo: string; cuerpo: string; url: string; etiqueta?: string };

/** Envía una notificación push a una lista de suscripciones. Borra las que ya no existen. */
export async function enviarPush(env: Env, subs: { endpoint: string; p256dh: string; auth: string }[], aviso: Aviso) {
  if (!subs.length) return { enviadas: 0, fallidas: 0 };
  const vapid = { ...(await clavesVapid(env)), subject: env.WEB_URL || 'https://olimpobarberclub.pensolabs.com' };
  let enviadas = 0, fallidas = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const pedido = await buildPushPayload({ data: aviso, options: { ttl: 3600, urgency: 'high' } },
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } }, vapid);
      const r = await fetch(s.endpoint, pedido);
      if (r.ok) enviadas++;
      else {
        fallidas++;
        if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM suscripciones_push WHERE endpoint = ?').bind(s.endpoint).run();
        else console.error('push', r.status, (await r.text()).slice(0, 200));
      }
    } catch (e) { fallidas++; console.error('push', e); }
  }));
  return { enviadas, fallidas };
}

const TITULOS = { nueva: 'Nueva cita', cancelada: 'Cita cancelada', movida: 'Cita cambiada de hora', recuperada: 'Cita recuperada (con recargo)', comprobante: 'Comprobante de pago recibido' } as const;

/** Avisa al barbero de la cita y a los administradores: push del navegador y WhatsApp al barbero. */
export async function notificarPersonal(env: Env, codigo: string, tipo: keyof typeof TITULOS) {
  const c = await env.DB.prepare(
    `SELECT c.id, c.codigo, c.barbero_id, c.inicio, c.nombre, c.servicios, c.total_l, b.nombre AS barbero, b.telefono AS tel_barbero
     FROM citas c JOIN barberos b ON b.id = c.barbero_id WHERE c.codigo = ?`).bind(codigo).first<any>();
  if (!c) return;
  const servicios = JSON.parse(c.servicios).map((s: any) => s.nombre).join(' + ');
  const cuerpo = `${c.nombre} · ${fechaTexto(c.inicio)} · ${servicios} · L ${c.total_l}`;
  const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth FROM suscripciones_push WHERE barbero_id = ? OR admin = 1').bind(c.barbero_id).all<any>()).results;
  await enviarPush(env, subs, { titulo: TITULOS[tipo], cuerpo, url: 'barbero', etiqueta: `cita-${c.codigo}` });
  if (c.tel_barbero) {
    await enviarWA(env, c.tel_barbero, `${TITULOS[tipo]} en ${await nombreNegocio(env)}\n${cuerpo}\nCódigo ${c.codigo}`, {
      cita_id: c.id, tipo: `personal_${tipo}`,
      plantilla: env.WA_PLANTILLA_PERSONAL ? { nombre: env.WA_PLANTILLA_PERSONAL, parametros: [TITULOS[tipo], cuerpo, c.codigo] } : undefined,
    });
  }
}

export async function guardarSuscripcion(env: Env, d: any, barbero_id: number | null, admin: boolean) {
  const { endpoint, keys } = d ?? {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') return false;
  await env.DB.prepare(
    `INSERT INTO suscripciones_push (endpoint, p256dh, auth, barbero_id, admin, creado_en) VALUES (?1,?2,?3,?4,?5,?6)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, barbero_id = ?4, admin = ?5`)
    .bind(endpoint, keys.p256dh, keys.auth, barbero_id, admin ? 1 : 0, utc()).run();
  return true;
}
