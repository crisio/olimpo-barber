import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  Env, utc, ahoraLocal, sumarMin, sumarDias, minutosEntre, sha256, aleatorioHex, hashPin, pinValido,
  codigoCorto, nombrePublico, normalizarTel, disponibilidad, ESTADOS_VIVOS, nombreNegocio,
} from './lib';
import { clavesVapid, enviarPush, guardarSuscripcion, notificarPersonal } from './push';
import { enviarWA, ofrecerHora, procesarEntrante, firmaValida, manejarWebhook, tareasProgramadas, waConfigurado } from './whatsapp';

type Sesion = { rol: 'dueno' | 'barbero'; usuario_id: number | null; barbero_id: number | null; cambiar?: number };
type C = Context<{ Bindings: Env; Variables: { sesion: Sesion } }>;
const app = new Hono<{ Bindings: Env; Variables: { sesion: Sesion } }>();

const origenes = (env: Env) => env.ORIGEN_WEB.split(',').map((s) => s.trim());
app.use('*', (c, next) => cors({
  origin: (o) => (origenes(c.env).includes(o) ? o : null),
  allowHeaders: ['content-type', 'authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
})(c, next));

app.onError((e, c) => {
  console.error(e);
  return c.json({ error: 'Algo salió mal. Intenta de nuevo.' }, 500);
});

/** Sube cuando la API gana funciones que la web necesita saber si están publicadas. */
const VERSION_API = 3; // 2: configuración desde el teléfono · 3: cuentas para transferencias
const escaparHtml = (t: string) => t.replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]!);

const err = (c: C, mensaje: string, estado: 400 | 401 | 403 | 404 | 409 | 429 = 400, extra: object = {}) =>
  c.json({ error: mensaje, ...extra }, estado);
const cuerpo = async (c: C) => (await c.req.json().catch(() => ({}))) as any;
const ip = (c: C) => c.req.header('cf-connecting-ip') ?? 'local';

// ---------- Límite de intentos ----------
async function demasiados(c: C, clave: string, max: number, minutos = 15) {
  const desde = new Date(Date.now() - minutos * 60e3).toISOString();
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM intentos WHERE clave = ? AND cuando > ?').bind(clave, desde).first<any>();
  return r.n >= max;
}
const anotarIntento = (c: C, clave: string) =>
  c.env.DB.prepare('INSERT INTO intentos (clave, cuando) VALUES (?, ?)').bind(clave, utc()).run();

// ---------- Sesiones ----------
async function crearSesion(c: C, s: Sesion) {
  const token = aleatorioHex(32);
  const dias = s.rol === 'dueno' ? 30 : 14;
  await c.env.DB.prepare('INSERT INTO sesiones (token_hash, rol, usuario_id, barbero_id, expira_en) VALUES (?,?,?,?,?)')
    .bind(await sha256(token), s.rol, s.usuario_id, s.barbero_id, new Date(Date.now() + dias * 864e5).toISOString()).run();
  return token;
}
async function leerSesion(c: C): Promise<Sesion | null> {
  const t = c.req.header('authorization')?.replace(/^Bearer /, '');
  if (!t) return null;
  return await c.env.DB.prepare(
    `SELECT s.rol, s.usuario_id, s.barbero_id, COALESCE(b.debe_cambiar_pin, 0) AS cambiar
     FROM sesiones s LEFT JOIN barberos b ON b.id = s.barbero_id WHERE s.token_hash = ? AND s.expira_en > ?`)
    .bind(await sha256(t), utc()).first<Sesion>();
}
const requiere = (...roles: Sesion['rol'][]) => async (c: C, next: () => Promise<void>) => {
  const s = await leerSesion(c);
  if (!s) return err(c, 'Inicia sesión de nuevo.', 401);
  if (!roles.includes(s.rol)) return err(c, 'No tienes permiso para esto.', 403);
  // Con PIN temporal no se puede hacer nada hasta cambiarlo
  if (s.cambiar && !c.req.path.startsWith('/api/auth/')) return err(c, 'Primero cambia tu PIN temporal.', 403, { cambiar_pin: true });
  c.set('sesion', s);
  await next();
};
const personal = requiere('dueno', 'barbero');
const dueno = requiere('dueno');

// ---------- Datos públicos ----------
const COLS_CITA_PUBLICA = `c.codigo, c.inicio, c.estado, c.nombre_publico, c.servicios, c.total_l, c.recargo_l,
  c.recuperada, c.barbero_id, b.nombre AS barbero, b.apodo AS barbero_apodo, (c.telefono IS NOT NULL) AS con_whatsapp`;

async function datosBarberia(env: Env) {
  const [b, barberos, servicios] = await Promise.all([
    env.DB.prepare('SELECT * FROM barberia WHERE id = 1').first<any>(),
    env.DB.prepare('SELECT id, nombre, apodo, foto_key, orden, activo, (pin_hash IS NOT NULL) AS con_pin, es_admin, pin_digitos, atiende, debe_cambiar_pin, telefono FROM barberos ORDER BY orden, id').all<any>(),
    env.DB.prepare('SELECT * FROM servicios ORDER BY orden, id').all<any>(),
  ]);
  return {
    barberia: { ...b, horario: JSON.parse(b.horario), almuerzo: b.almuerzo ? JSON.parse(b.almuerzo) : null, cuentas: leerCuentas(b.cuentas) },
    barberos: barberos.results, servicios: servicios.results,
  };
}

type Cuenta = { id: string; banco: string; banco_nombre: string; tipo: string; moneda: string; numero: string; titular: string; nota: string; activa: boolean };
function leerCuentas(v: unknown): Cuenta[] {
  try { const l = JSON.parse(String(v ?? '[]')); return Array.isArray(l) ? l : []; } catch { return []; }
}
const cuentasVisibles = (l: Cuenta[]) => l.filter((x) => x.activa);

app.get('/api/barberia', async (c) => {
  const d = await datosBarberia(c.env);
  const hoy = ahoraLocal().slice(0, 10);
  // Próxima hora libre en los siguientes días
  let proxima: string | null = null;
  for (let i = 0; i <= Math.min(d.barberia.dias_anticipacion, 7) && !proxima && d.barberia.agenda_abierta; i++) {
    proxima = (await disponibilidad(c.env, sumarDias(hoy, i))).find((h) => h.barberos.length)?.inicio ?? null;
  }
  return c.json({
    ...d,
    barberia: { ...d.barberia, cuentas: cuentasVisibles(d.barberia.cuentas) },
    barberos: d.barberos.filter((x: any) => x.activo && x.atiende).map(({ es_admin, debe_cambiar_pin, telefono, ...x }: any) => x),
    // Quiénes pueden entrar con PIN (incluye administradores que no atienden)
    personal: d.barberos.filter((x: any) => x.activo && x.con_pin).map((x: any) => ({ id: x.id, nombre: x.nombre, apodo: x.apodo, pin_digitos: x.pin_digitos })),
    servicios: d.servicios.filter((x: any) => x.activo),
    proxima_libre: proxima, ahora: ahoraLocal(), version: VERSION_API,
  });
});

// Nombre y logo del negocio: lo usa cada pantalla para pintar el encabezado
app.get('/api/marca', async (c) => {
  const b = await c.env.DB.prepare('SELECT nombre, marca_titulo, marca_subtitulo, logo_key, logo_con_texto FROM barberia WHERE id = 1').first<any>();
  return c.json({ ...b, version: VERSION_API }, 200, { 'cache-control': 'no-cache' });
});

app.get('/api/disponibilidad', async (c) => {
  const fecha = c.req.query('fecha') ?? ahoraLocal().slice(0, 10);
  return c.json({ fecha, horas: await disponibilidad(c.env, fecha) });
});

app.get('/api/pantalla', async (c) => {
  const hoy = ahoraLocal().slice(0, 10);
  const citas = (await c.env.DB.prepare(
    `SELECT c.inicio, c.estado, c.nombre_publico, b.nombre AS barbero FROM citas c JOIN barberos b ON b.id = c.barbero_id
     WHERE c.inicio LIKE ? AND c.estado IN ('agendada','en_atencion') ORDER BY c.inicio`).bind(hoy + '%').all()).results;
  const b = await c.env.DB.prepare('SELECT nombre, tolerancia_min FROM barberia WHERE id = 1').first<any>();
  return c.json({ barberia: b, citas, ahora: ahoraLocal() });
});

app.get('/api/archivos/:clave{.+}', async (c) => {
  const o = await c.env.ARCHIVOS?.get(c.req.param('clave'));
  if (!o) return c.notFound();
  return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'public, max-age=86400' } });
});

// ---------- Citas (cliente) ----------
async function turnstileOk(c: C, token?: string) {
  if (!c.env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET, response: token, remoteip: ip(c) }),
  });
  return ((await r.json()) as any).success === true;
}

async function upsertCliente(env: Env, telefono: string | null, nombre: string, consentimiento: boolean, inicio: string) {
  if (!telefono) return null;
  await env.DB.prepare(
    `INSERT INTO clientes (telefono, nombre, consentimiento, ultima_cita, creado_en) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(telefono) DO UPDATE SET nombre = ?2, consentimiento = MAX(consentimiento, ?3), ultima_cita = ?4`)
    .bind(telefono, nombre, consentimiento ? 1 : 0, inicio, utc()).run();
  return (await env.DB.prepare('SELECT id FROM clientes WHERE telefono = ?').bind(telefono).first<any>())?.id ?? null;
}

/** Crea la cita validando hora libre. Devuelve {codigo} o {error}. */
async function crearCita(env: Env, d: {
  nombre: string; telefono: string | null; consentimiento: boolean; barbero_id: number | null; servicio_ids: number[];
  inicio: string; dispositivo: string | null; origen: 'web' | 'manual'; recargo_l?: number; recuperada_de?: number;
}): Promise<{ codigo: string } | { error: string }> {
  const hora = (await disponibilidad(env, d.inicio.slice(0, 10), { sinAnticipacion: d.origen === 'manual' })).find((h) => h.inicio === d.inicio);
  if (!hora) return { error: 'Esa hora no está disponible.' };
  let barbero = d.barbero_id;
  if (barbero) {
    if (!hora.barberos.includes(barbero)) return { error: 'Esa hora ya se ocupó. Elige otra.' };
  } else {
    if (!hora.barberos.length) return { error: 'Esa hora ya se ocupó. Elige otra.' };
    // "El primero libre": el barbero con menos citas ese día
    const carga = (await env.DB.prepare(
      `SELECT barbero_id, COUNT(*) AS n FROM citas WHERE inicio LIKE ? AND estado IN ${ESTADOS_VIVOS} GROUP BY barbero_id`)
      .bind(d.inicio.slice(0, 10) + '%').all<any>()).results;
    const n = (id: number) => carga.find((x) => x.barbero_id === id)?.n ?? 0;
    barbero = [...hora.barberos].sort((a, b) => n(a) - n(b))[0];
  }
  const ids = [...new Set(d.servicio_ids.map(Number))].filter(Boolean);
  if (!ids.length) return { error: 'Elige al menos un servicio.' };
  const servicios = (await env.DB.prepare(
    `SELECT id, nombre, precio_l FROM servicios WHERE activo = 1 AND id IN (${ids.map(() => '?').join(',')}) ORDER BY orden`)
    .bind(...ids).all<any>()).results;
  if (servicios.length !== ids.length) return { error: 'Servicio no válido.' };
  const recargo = d.recargo_l ?? 0;
  const total = servicios.reduce((s, x) => s + x.precio_l, 0) + recargo;
  const cliente = await upsertCliente(env, d.telefono, d.nombre, d.consentimiento, d.inicio);
  for (let intento = 0; intento < 4; intento++) {
    const codigo = codigoCorto();
    try {
      await env.DB.prepare(
        `INSERT INTO citas (codigo, barbero_id, inicio, nombre, nombre_publico, telefono, cliente_id, dispositivo,
           servicios, total_l, recargo_l, origen, recuperada_de, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(codigo, barbero, d.inicio, d.nombre, nombrePublico(d.nombre), d.telefono, cliente, d.dispositivo,
          JSON.stringify(servicios), total, recargo, d.origen, d.recuperada_de ?? null, utc()).run();
      return { codigo };
    } catch (e: any) {
      if (String(e?.message).includes('ux_cita_hora') || String(e?.message).includes('citas.barbero_id'))
        return { error: 'Esa hora se acaba de ocupar. Elige otra.' };
      if (intento === 3) throw e; // choque de código: reintenta
    }
  }
  return { error: 'No se pudo crear la cita.' };
}

const hhmm = (v: unknown) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
const limpiarNombre = (n: unknown) => String(n ?? '').replace(/[<>\n\r]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

app.post('/api/citas', async (c) => {
  const d = await cuerpo(c);
  const b = await c.env.DB.prepare('SELECT agenda_abierta FROM barberia WHERE id = 1').first<any>();
  if (!b.agenda_abierta) return err(c, 'La agenda está cerrada por ahora.', 409);
  if (await demasiados(c, `cita:${ip(c)}`, 8, 60)) return err(c, 'Demasiadas citas desde este dispositivo. Intenta más tarde.', 429);
  if (!(await turnstileOk(c, d.turnstile))) return err(c, 'No pudimos verificar que eres una persona. Recarga e intenta de nuevo.', 403);
  const nombre = limpiarNombre(d.nombre);
  if (nombre.length < 2) return err(c, 'Escribe tu nombre.');
  const telefono = d.telefono ? normalizarTel(d.telefono) : null;
  if (d.telefono && !telefono) return err(c, 'Revisa el número de WhatsApp (8 dígitos).');
  const dispositivo = String(d.dispositivo ?? '').slice(0, 64) || null;
  if (dispositivo) {
    const viva = await c.env.DB.prepare(
      `SELECT codigo FROM citas WHERE dispositivo = ? AND estado = 'agendada' AND inicio > ?`)
      .bind(dispositivo, sumarMin(ahoraLocal(), -30)).first<any>();
    if (viva) return err(c, 'Ya tienes una cita activa.', 409, { codigo: viva.codigo });
  }
  const r = await crearCita(c.env, {
    nombre, telefono, consentimiento: !!telefono, barbero_id: Number(d.barbero_id) || null,
    servicio_ids: Array.isArray(d.servicios) ? d.servicios : [], inicio: String(d.inicio ?? ''), dispositivo, origen: 'web',
  });
  if ('error' in r) return err(c, r.error, 409);
  await anotarIntento(c, `cita:${ip(c)}`);
  c.executionCtx.waitUntil(notificarPersonal(c.env, r.codigo, 'nueva').catch((e) => console.error('aviso', e)));
  return c.json(r);
});

const citaPublica = (env: Env, codigo: string) => env.DB.prepare(
  `SELECT ${COLS_CITA_PUBLICA}, c.id AS _id FROM citas c JOIN barberos b ON b.id = c.barbero_id WHERE c.codigo = ?`)
  .bind(codigo.toUpperCase()).first<any>();

app.get('/api/citas/:codigo', async (c) => {
  const cita = await citaPublica(c.env, c.req.param('codigo'));
  if (!cita) return err(c, 'No encontramos esa cita.', 404);
  const b = await c.env.DB.prepare('SELECT nombre, direccion, mapa_url, whatsapp_numero, tolerancia_min, recargo_l, dias_anticipacion, horario, cuentas FROM barberia WHERE id = 1').first<any>();
  b.horario = JSON.parse(b.horario);
  b.cuentas = cuentasVisibles(leerCuentas(b.cuentas));
  const { _id, ...resto } = cita;
  return c.json({ cita: { ...resto, servicios: JSON.parse(cita.servicios) }, barberia: b, ahora: ahoraLocal() });
});

app.post('/api/citas/:codigo/cancelar', async (c) => {
  const r = await c.env.DB.prepare(`UPDATE citas SET estado = 'cancelada' WHERE codigo = ? AND estado = 'agendada'`)
    .bind(c.req.param('codigo').toUpperCase()).run();
  if (!r.meta.changes) return err(c, 'Esta cita ya no se puede cancelar.', 409);
  const libre = await c.env.DB.prepare('SELECT inicio FROM citas WHERE codigo = ?').bind(c.req.param('codigo').toUpperCase()).first<any>();
  c.executionCtx.waitUntil(ofrecerHora(c.env, libre.inicio, ahoraLocal()).catch((e) => console.error('ofrecer', e)));
  c.executionCtx.waitUntil(notificarPersonal(c.env, c.req.param('codigo').toUpperCase(), 'cancelada').catch((e) => console.error('aviso', e)));
  return c.json({ ok: true });
});

// Cambiar la hora de una cita (por ejemplo, adelantarla a una hora que se liberó). Sin recargo.
app.post('/api/citas/:codigo/mover', async (c) => {
  const d = await cuerpo(c);
  const inicio = String(d.inicio ?? '');
  const cita = await c.env.DB.prepare('SELECT * FROM citas WHERE codigo = ?').bind(c.req.param('codigo').toUpperCase()).first<any>();
  const ahora = ahoraLocal();
  if (!cita || cita.estado !== 'agendada' || cita.inicio <= ahora) return err(c, 'Esta cita ya no se puede cambiar.', 409);
  const hora = (await disponibilidad(c.env, inicio.slice(0, 10))).find((h) => h.inicio === inicio);
  if (!hora?.barberos.length) return err(c, 'Esa hora ya se ocupó. Elige otra.', 409);
  const barbero = hora.barberos.includes(cita.barbero_id) ? cita.barbero_id : hora.barberos[0];
  try {
    await c.env.DB.prepare('UPDATE citas SET inicio = ?, barbero_id = ?, recordatorio_enviado = 0 WHERE id = ?').bind(inicio, barbero, cita.id).run();
  } catch { return err(c, 'Esa hora se acaba de ocupar. Elige otra.', 409); }
  c.executionCtx.waitUntil(ofrecerHora(c.env, cita.inicio, ahora).catch((e) => console.error('ofrecer', e)));
  c.executionCtx.waitUntil(notificarPersonal(c.env, cita.codigo, 'movida').catch((e) => console.error('aviso', e)));
  return c.json({ ok: true });
});

// Recuperar una cita perdida: nueva hora + recargo
app.post('/api/citas/:codigo/recuperar', async (c) => {
  const d = await cuerpo(c);
  const vieja = await c.env.DB.prepare('SELECT * FROM citas WHERE codigo = ?').bind(c.req.param('codigo').toUpperCase()).first<any>();
  if (!vieja || vieja.estado !== 'no_llego') return err(c, 'Esta cita no se puede recuperar.', 409);
  if (vieja.recuperada) return err(c, 'Esta cita ya fue recuperada.', 409);
  const b = await c.env.DB.prepare('SELECT recargo_l FROM barberia WHERE id = 1').first<any>();
  const r = await crearCita(c.env, {
    nombre: vieja.nombre, telefono: vieja.telefono, consentimiento: false, barbero_id: Number(d.barbero_id) || null,
    servicio_ids: JSON.parse(vieja.servicios).map((s: any) => s.id), inicio: String(d.inicio ?? ''),
    dispositivo: vieja.dispositivo, origen: 'web', recargo_l: b.recargo_l, recuperada_de: vieja.id,
  });
  if ('error' in r) return err(c, r.error, 409);
  await c.env.DB.prepare('UPDATE citas SET recuperada = 1 WHERE id = ?').bind(vieja.id).run();
  c.executionCtx.waitUntil(notificarPersonal(c.env, r.codigo, 'recuperada').catch((e) => console.error('aviso', e)));
  return c.json(r);
});

// ---------- Acceso ----------
const emailsDueno = (env: Env) => (env.OWNER_EMAIL ?? '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

app.post('/api/auth/codigo', async (c) => {
  const email = String((await cuerpo(c)).email ?? '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return err(c, 'Escribe un correo válido.');
  if (await demasiados(c, `codigo:${ip(c)}`, 5) || await demasiados(c, `codigo:${email}`, 5)) return err(c, 'Demasiados intentos. Espera 15 minutos.', 429);
  await anotarIntento(c, `codigo:${ip(c)}`);
  await anotarIntento(c, `codigo:${email}`);
  const autorizado = emailsDueno(c.env).includes(email) ||
    !!(await c.env.DB.prepare('SELECT 1 FROM usuarios WHERE email = ?').bind(email).first());
  const respuesta: any = { ok: true }; // misma respuesta exista o no el correo
  if (autorizado) {
    const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
    await c.env.DB.prepare('INSERT OR REPLACE INTO codigos_login (email, codigo_hash, expira_en) VALUES (?,?,?)')
      .bind(email, await sha256(`${email}:${codigo}`), new Date(Date.now() + 10 * 60e3).toISOString()).run();
    if (c.env.RESEND_API_KEY) {
      const negocio = escaparHtml((await nombreNegocio(c.env)));
      const enviar = (contenido: object) => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: c.env.RESEND_FROM, to: [email], ...contenido }),
      });
      // Primero la plantilla publicada en Resend; si falla, un correo sencillo con el mismo código
      let r = c.env.RESEND_PLANTILLA
        ? await enviar({ template: { id: c.env.RESEND_PLANTILLA, variables: { CODE: codigo, USER_NAME: email.split('@')[0], EXPIRES_MINUTES: '10' } } })
        : null;
      if (!r?.ok) {
        if (r) console.error('Resend plantilla', r.status, await r.text());
        r = await enviar({
          subject: `${codigo} es tu código de TurnoYa`,
          html: `<div style="font-family:sans-serif;max-width:420px"><h2>TurnoYa · ${negocio}</h2><p>Tu código para entrar es:</p><p style="font-size:34px;letter-spacing:6px;font-weight:700">${codigo}</p><p>Vence en 10 minutos. Si no lo pediste, ignora este correo.</p></div>`,
        });
        if (!r.ok) console.error('Resend', r.status, await r.text());
      }
    } else if (c.env.ENTORNO === 'dev') {
      respuesta.codigo_dev = codigo; // solo en desarrollo, sin Resend
    }
  }
  return c.json(respuesta);
});

async function usuarioPorEmail(env: Env, email: string) {
  await env.DB.prepare('INSERT OR IGNORE INTO usuarios (email, creado_en) VALUES (?, ?)').bind(email, utc()).run();
  return (await env.DB.prepare('SELECT id, email FROM usuarios WHERE email = ?').bind(email).first<any>())!;
}

app.post('/api/auth/verificar', async (c) => {
  const d = await cuerpo(c);
  const email = String(d.email ?? '').toLowerCase().trim();
  if (await demasiados(c, `verif:${email}`, 6)) return err(c, 'Demasiados intentos. Espera 15 minutos.', 429);
  await anotarIntento(c, `verif:${email}`);
  const fila = await c.env.DB.prepare('SELECT * FROM codigos_login WHERE email = ? AND expira_en > ?').bind(email, utc()).first<any>();
  if (!fila || fila.codigo_hash !== (await sha256(`${email}:${String(d.codigo ?? '').trim()}`))) return err(c, 'Código incorrecto o vencido.', 401);
  await c.env.DB.prepare('DELETE FROM codigos_login WHERE email = ?').bind(email).run();
  const u = await usuarioPorEmail(c.env, email);
  return c.json({ token: await crearSesion(c, { rol: 'dueno', usuario_id: u.id, barbero_id: null }), rol: 'dueno' });
});

app.post('/api/auth/pin', async (c) => {
  const d = await cuerpo(c);
  const id = Number(d.barbero_id);
  if (await demasiados(c, `pin:${id}`, 5) || await demasiados(c, `pin:${ip(c)}`, 10)) return err(c, 'Demasiados intentos. Espera 15 minutos.', 429);
  const b = await c.env.DB.prepare('SELECT id, pin_hash, es_admin, debe_cambiar_pin FROM barberos WHERE id = ? AND activo = 1').bind(id).first<any>();
  if (!b?.pin_hash || !(await pinValido(String(d.pin ?? ''), b.pin_hash))) {
    await anotarIntento(c, `pin:${id}`);
    await anotarIntento(c, `pin:${ip(c)}`);
    return err(c, 'PIN incorrecto.', 401);
  }
  // El barbero administrador entra al panel del dueño con su PIN
  const rol = b.es_admin ? 'dueno' : 'barbero';
  return c.json({ token: await crearSesion(c, { rol, usuario_id: null, barbero_id: b.id }), rol, cambiar_pin: !!b.debe_cambiar_pin });
});

app.get('/api/auth/yo', personal, async (c) => {
  const s = c.get('sesion');
  // passkeys = -1: sesión por PIN, sin correo, donde Face ID no aplica
  const passkeys = s.usuario_id
    ? (await c.env.DB.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE usuario_id = ?').bind(s.usuario_id).first<any>()).n : -1;
  const propio = s.barbero_id ? await c.env.DB.prepare('SELECT atiende, es_admin FROM barberos WHERE id = ?').bind(s.barbero_id).first<any>() : null;
  return c.json({ rol: s.rol, usuario_id: s.usuario_id, barbero_id: s.barbero_id, passkeys, cambiar_pin: !!s.cambiar, atiende: !!propio?.atiende });
});

// El propio barbero o administrador cambia su PIN (obligatorio si entró con uno temporal)
const PINES_OBVIOS = new Set(['123456', '000000', '111111', '654321', '1234', '0000', '1111']);
app.post('/api/auth/cambiar-pin', personal, async (c) => {
  const s = c.get('sesion');
  const pin = String((await cuerpo(c)).pin ?? '');
  const b = s.barbero_id ? await c.env.DB.prepare('SELECT id, es_admin, pin_hash FROM barberos WHERE id = ?').bind(s.barbero_id).first<any>() : null;
  if (!b) return err(c, 'Esta sesión no usa PIN.');
  if (!/^\d{6}$/.test(pin)) return err(c, 'El PIN debe tener 6 números.');
  if (PINES_OBVIOS.has(pin) || /^(\d)\1+$/.test(pin)) return err(c, 'Ese PIN es muy fácil de adivinar. Elige otro.');
  if (b.pin_hash && (await pinValido(pin, b.pin_hash))) return err(c, 'El PIN nuevo debe ser distinto al actual.');
  await c.env.DB.prepare('UPDATE barberos SET pin_hash = ?, pin_digitos = ?, debe_cambiar_pin = 0 WHERE id = ?').bind(await hashPin(pin), pin.length, b.id).run();
  const mia = await sha256(c.req.header('authorization')!.replace(/^Bearer /, ''));
  await c.env.DB.prepare('DELETE FROM sesiones WHERE barbero_id = ? AND token_hash != ?').bind(b.id, mia).run();
  return c.json({ ok: true });
});

app.post('/api/auth/salir', async (c) => {
  const t = c.req.header('authorization')?.replace(/^Bearer /, '');
  if (t) await c.env.DB.prepare('DELETE FROM sesiones WHERE token_hash = ?').bind(await sha256(t)).run();
  return c.json({ ok: true });
});

// Face ID / huella (passkeys)
const origenPasskey = (c: C) => {
  const o = c.req.header('origin') ?? '';
  return origenes(c.env).includes(o) ? o : origenes(c.env)[0];
};
const guardarReto = async (c: C, reto: string, usuario_id: number | null) => {
  const id = aleatorioHex(16);
  await c.env.DB.prepare('INSERT INTO retos (id, reto, usuario_id, expira_en) VALUES (?,?,?,?)')
    .bind(id, reto, usuario_id, new Date(Date.now() + 5 * 60e3).toISOString()).run();
  return id;
};
const tomarReto = async (c: C, id: string) => {
  const r = await c.env.DB.prepare('SELECT * FROM retos WHERE id = ? AND expira_en > ?').bind(String(id), utc()).first<any>();
  await c.env.DB.prepare('DELETE FROM retos WHERE id = ? OR expira_en < ?').bind(String(id), utc()).run();
  return r;
};
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const deB64 = (s: string) => Uint8Array.from(atob(s), (x) => x.charCodeAt(0));

app.post('/api/auth/passkey/registro/opciones', dueno, async (c) => {
  const s = c.get('sesion');
  if (!s.usuario_id) return err(c, 'Face ID se activa entrando con el correo del dueño.');
  const u = await c.env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(s.usuario_id).first<any>();
  const ya = (await c.env.DB.prepare('SELECT id FROM passkeys WHERE usuario_id = ?').bind(u.id).all<any>()).results;
  const opciones = await generateRegistrationOptions({
    rpName: `TurnoYa · ${await nombreNegocio(c.env)}`, rpID: c.env.RP_ID, userName: u.email,
    userID: new TextEncoder().encode(String(u.id)) as Uint8Array<ArrayBuffer>, attestationType: 'none',
    excludeCredentials: ya.map((p) => ({ id: p.id })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  return c.json({ opciones, reto_id: await guardarReto(c, opciones.challenge, u.id) });
});

app.post('/api/auth/passkey/registro/verificar', dueno, async (c) => {
  const d = await cuerpo(c);
  const reto = await tomarReto(c, d.reto_id);
  if (!reto || reto.usuario_id !== c.get('sesion').usuario_id) return err(c, 'La solicitud venció. Intenta de nuevo.');
  const v = await verifyRegistrationResponse({
    response: d.respuesta, expectedChallenge: reto.reto, expectedOrigin: origenPasskey(c), expectedRPID: c.env.RP_ID,
  }).catch(() => null);
  if (!v?.verified || !v.registrationInfo) return err(c, 'No se pudo registrar Face ID / huella.');
  const cred = v.registrationInfo.credential;
  await c.env.DB.prepare('INSERT INTO passkeys (id, usuario_id, clave_publica, contador, transportes, creado_en) VALUES (?,?,?,?,?,?)')
    .bind(cred.id, reto.usuario_id, b64(cred.publicKey), cred.counter, JSON.stringify(cred.transports ?? []), utc()).run();
  return c.json({ ok: true });
});

app.post('/api/auth/passkey/login/opciones', async (c) => {
  if (await demasiados(c, `pk:${ip(c)}`, 20)) return err(c, 'Demasiados intentos. Espera 15 minutos.', 429);
  await anotarIntento(c, `pk:${ip(c)}`);
  const opciones = await generateAuthenticationOptions({ rpID: c.env.RP_ID, userVerification: 'required' });
  return c.json({ opciones, reto_id: await guardarReto(c, opciones.challenge, null) });
});

app.post('/api/auth/passkey/login/verificar', async (c) => {
  const d = await cuerpo(c);
  const reto = await tomarReto(c, d.reto_id);
  const pk = await c.env.DB.prepare('SELECT * FROM passkeys WHERE id = ?').bind(String(d.respuesta?.id ?? '')).first<any>();
  if (!reto || !pk) return err(c, 'No reconocemos este dispositivo. Entra con tu correo.', 401);
  const v = await verifyAuthenticationResponse({
    response: d.respuesta, expectedChallenge: reto.reto, expectedOrigin: origenPasskey(c), expectedRPID: c.env.RP_ID,
    credential: { id: pk.id, publicKey: deB64(pk.clave_publica), counter: pk.contador, transports: JSON.parse(pk.transportes ?? '[]') },
    requireUserVerification: true,
  }).catch(() => null);
  if (!v?.verified) return err(c, 'No se pudo verificar. Entra con tu correo.', 401);
  await c.env.DB.prepare('UPDATE passkeys SET contador = ? WHERE id = ?').bind(v.authenticationInfo.newCounter, pk.id).run();
  return c.json({ token: await crearSesion(c, { rol: 'dueno', usuario_id: pk.usuario_id, barbero_id: null }), rol: 'dueno' });
});

// ---------- Notificaciones push del personal ----------
app.get('/api/push/clave', personal, async (c) => c.json({ clave: (await clavesVapid(c.env)).publicKey }));
app.post('/api/push/suscribir', personal, async (c) => {
  const s = c.get('sesion');
  if (!(await guardarSuscripcion(c.env, await cuerpo(c), s.barbero_id, s.rol === 'dueno'))) return err(c, 'No se pudo activar en este dispositivo.');
  return c.json({ ok: true });
});
app.post('/api/push/quitar', personal, async (c) => {
  await c.env.DB.prepare('DELETE FROM suscripciones_push WHERE endpoint = ?').bind(String((await cuerpo(c)).endpoint ?? '')).run();
  return c.json({ ok: true });
});
app.post('/api/push/prueba', personal, async (c) => {
  const sub = await c.env.DB.prepare('SELECT endpoint, p256dh, auth FROM suscripciones_push WHERE endpoint = ?').bind(String((await cuerpo(c)).endpoint ?? '')).first<any>();
  if (!sub) return err(c, 'Este dispositivo no tiene notificaciones activas.');
  const r = await enviarPush(c.env, [sub], { titulo: 'Notificaciones activas', cuerpo: 'Así te avisaremos cuando alguien reserve.', url: 'barbero', etiqueta: 'prueba' });
  return r.enviadas ? c.json({ ok: true }) : err(c, 'El envío de prueba falló. Intenta activar de nuevo.');
});

// ---------- Personal: agenda ----------
app.get('/api/agenda', personal, async (c) => {
  const s = c.get('sesion');
  const fecha = c.req.query('fecha') ?? ahoraLocal().slice(0, 10);
  const propio = s.rol === 'dueno' && s.barbero_id ? await c.env.DB.prepare('SELECT atiende FROM barberos WHERE id = ?').bind(s.barbero_id).first<any>() : null;
  const barbero = s.rol === 'barbero' ? s.barbero_id : Number(c.req.query('barbero')) || (propio?.atiende ? s.barbero_id : null);
  const [citas, bloqueos, horas, datos] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.id, c.codigo, c.barbero_id, c.inicio, c.estado, c.nombre, c.nombre_publico, c.telefono, c.servicios,
              c.total_l, c.recargo_l, c.origen, c.llego_en, c.terminado_en, k.no_llegadas, k.visitas
       FROM citas c LEFT JOIN clientes k ON k.id = c.cliente_id
       WHERE c.inicio LIKE ?1 AND (?2 IS NULL OR c.barbero_id = ?2) AND c.estado != 'cancelada' ORDER BY c.inicio, c.id`)
      .bind(fecha + '%', barbero).all<any>(),
    c.env.DB.prepare('SELECT barbero_id, inicio FROM bloqueos WHERE inicio LIKE ?1 AND (?2 IS NULL OR barbero_id = ?2)').bind(fecha + '%', barbero).all<any>(),
    disponibilidad(c.env, fecha, { sinAnticipacion: true }),
    datosBarberia(c.env),
  ]);
  return c.json({
    fecha, ahora: ahoraLocal(), barbero_id: barbero, ...datos,
    citas: citas.results.map((x) => ({ ...x, servicios: JSON.parse(x.servicios) })),
    bloqueos: bloqueos.results, horas,
  });
});

app.post('/api/citas/:id/accion', personal, async (c) => {
  const s = c.get('sesion');
  const { accion } = await cuerpo(c);
  const cita = await c.env.DB.prepare('SELECT * FROM citas WHERE id = ?').bind(Number(c.req.param('id'))).first<any>();
  if (!cita) return err(c, 'No existe la cita.', 404);
  if (s.rol === 'barbero' && cita.barbero_id !== s.barbero_id) return err(c, 'Esa cita es de otro barbero.', 403);
  const ahora = ahoraLocal();
  const b = await c.env.DB.prepare('SELECT tolerancia_min FROM barberia WHERE id = 1').first<any>();
  const db = c.env.DB;
  if (accion === 'llego' && cita.estado === 'agendada') {
    await db.prepare(`UPDATE citas SET estado = 'en_atencion', llego_en = ? WHERE id = ?`).bind(ahora, cita.id).run();
  } else if (accion === 'termine' && cita.estado === 'en_atencion') {
    await db.prepare(`UPDATE citas SET estado = 'terminada', terminado_en = ? WHERE id = ?`).bind(ahora, cita.id).run();
    if (cita.cliente_id) await db.prepare('UPDATE clientes SET visitas = visitas + 1, ultima_cita = ? WHERE id = ?').bind(cita.inicio, cita.cliente_id).run();
  } else if (accion === 'no_llego' && cita.estado === 'agendada') {
    const faltan = minutosEntre(ahora, sumarMin(cita.inicio, b.tolerancia_min));
    if (faltan > 0) return err(c, `Aún está en tolerancia. Faltan ${faltan} min.`, 409);
    await db.prepare(`UPDATE citas SET estado = 'no_llego' WHERE id = ?`).bind(cita.id).run();
    if (cita.cliente_id) await db.prepare('UPDATE clientes SET no_llegadas = no_llegadas + 1 WHERE id = ?').bind(cita.cliente_id).run();
  } else if (accion === 'cancelar' && cita.estado === 'agendada') {
    await db.prepare(`UPDATE citas SET estado = 'cancelada' WHERE id = ?`).bind(cita.id).run();
    c.executionCtx.waitUntil(ofrecerHora(c.env, cita.inicio, ahora).catch((e) => console.error('ofrecer', e)));
  } else if (accion === 'deshacer' && ['en_atencion', 'no_llego'].includes(cita.estado) && !cita.recuperada) {
    await db.prepare(`UPDATE citas SET estado = 'agendada', llego_en = NULL WHERE id = ?`).bind(cita.id).run()
      .catch(() => { throw new Error('La hora ya fue ocupada por otra cita'); });
    if (cita.estado === 'no_llego' && cita.cliente_id) await db.prepare('UPDATE clientes SET no_llegadas = MAX(0, no_llegadas - 1) WHERE id = ?').bind(cita.cliente_id).run();
  } else {
    return err(c, 'Esa acción no aplica a esta cita.', 409);
  }
  return c.json({ ok: true });
});

app.post('/api/agenda/manual', personal, async (c) => {
  const s = c.get('sesion');
  const d = await cuerpo(c);
  const nombre = limpiarNombre(d.nombre);
  if (nombre.length < 2) return err(c, 'Escribe el nombre del cliente.');
  const telefono = d.telefono ? normalizarTel(d.telefono) : null;
  if (d.telefono && !telefono) return err(c, 'Revisa el número (8 dígitos).');
  const r = await crearCita(c.env, {
    nombre, telefono, consentimiento: false, barbero_id: s.rol === 'barbero' ? s.barbero_id : Number(d.barbero_id) || null,
    servicio_ids: Array.isArray(d.servicios) ? d.servicios : [], inicio: String(d.inicio ?? ''), dispositivo: null, origen: 'manual',
  });
  if ('error' in r) return err(c, r.error, 409);
  return c.json(r);
});

app.post('/api/bloqueos', personal, async (c) => {
  const s = c.get('sesion');
  const d = await cuerpo(c);
  const barbero = s.rol === 'barbero' ? s.barbero_id : Number(d.barbero_id);
  const inicio = String(d.inicio ?? '');
  if (!barbero || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inicio)) return err(c, 'Datos incompletos.');
  if (d.quitar) {
    await c.env.DB.prepare('DELETE FROM bloqueos WHERE barbero_id = ? AND inicio = ?').bind(barbero, inicio).run();
  } else {
    const ocupada = await c.env.DB.prepare(`SELECT 1 FROM citas WHERE barbero_id = ? AND inicio = ? AND estado IN ${ESTADOS_VIVOS}`).bind(barbero, inicio).first();
    if (ocupada) return err(c, 'Esa hora ya tiene una cita.', 409);
    await c.env.DB.prepare('INSERT OR IGNORE INTO bloqueos (barbero_id, inicio) VALUES (?, ?)').bind(barbero, inicio).run();
  }
  return c.json({ ok: true });
});

// ---------- Dueño: configuración ----------
app.get('/api/config', dueno, async (c) => c.json({ ...(await datosBarberia(c.env)), version: VERSION_API }));

const texto = (v: unknown, max: number) => String(v ?? '').replace(/[<>\r]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

/** Usuario de Instagram o TikTok: acepta "@usuario", "usuario" o el enlace del perfil. */
function usuarioRed(v: unknown) {
  let t = texto(v, 200);
  if (!t) return null;
  const m = t.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i);
  if (m) t = m[1];
  t = t.replace(/^@/, '');
  return /^[A-Za-z0-9._]{1,40}$/.test(t) ? t : undefined;
}
/** Página de Facebook: el nombre de la página o el enlace completo. */
function paginaFacebook(v: unknown) {
  let t = texto(v, 300);
  if (!t) return null;
  if (/^(https?:\/\/)?([a-z]+\.)?(facebook\.com|fb\.com|fb\.me)\//i.test(t)) return t.replace(/^(https?:\/\/)?/i, 'https://');
  t = t.replace(/^@/, '');
  return /^[A-Za-z0-9.\-]{2,80}$/.test(t) ? t : undefined;
}
/** Valida la lista de cuentas para transferencias. Devuelve el texto del error si algo no está bien. */
function normalizarCuentas(v: unknown): Cuenta[] | string {
  if (!Array.isArray(v)) return 'Lista de cuentas no válida.';
  if (v.length > 40) return 'Puedes poner hasta 40 cuentas.';
  const vistas = new Set<string>();
  const salida: Cuenta[] = [];
  for (const x of v as any[]) {
    const banco = /^[a-z0-9_-]{1,30}$/.test(String(x?.banco ?? '')) ? String(x.banco) : 'otro';
    const banco_nombre = limpiarNombre(x?.banco_nombre).slice(0, 40);
    if (banco === 'otro' && banco_nombre.length < 2) return 'Escribe el nombre del banco.';
    const numero = texto(x?.numero, 40).replace(/[^\dA-Za-z -]/g, '').trim();
    const activa = x?.activa !== false; // activa = disponible para que los clientes paguen ahí
    // Una cuenta no disponible puede quedar sin número (por ejemplo, un banco donde aún no hay cuenta)
    if (activa && (numero.match(/\d/g) ?? []).length < 4) return `Escribe el número de la cuenta${banco_nombre ? ` de ${banco_nombre}` : ''} o márcala como no disponible.`;
    let id = /^[a-z0-9]{4,16}$/.test(String(x?.id ?? '')) ? String(x.id) : aleatorioHex(4);
    if (vistas.has(id)) id = aleatorioHex(4);
    vistas.add(id);
    salida.push({
      id, banco, banco_nombre, numero,
      tipo: ['ahorro', 'cheques', 'billetera'].includes(x?.tipo) ? x.tipo : 'ahorro',
      moneda: x?.moneda === 'USD' ? 'USD' : 'HNL',
      titular: limpiarNombre(x?.titular).slice(0, 60),
      nota: texto(x?.nota, 140),
      activa,
    });
  }
  return salida;
}

/** Enlace de Google Maps (o cualquier https). */
function enlace(v: unknown) {
  const t = texto(v, 500);
  if (!t) return null;
  try { const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined; }
  catch { return undefined; }
}

// Solo cambia los datos que vienen en el cuerpo; así cada sección del panel guarda lo suyo.
app.put('/api/barberia', dueno, async (c) => {
  const d = await cuerpo(c);
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(d, k);
  const cols: string[] = [], vals: unknown[] = [];
  const poner = (col: string, v: unknown) => { cols.push(`${col} = ?`); vals.push(v); };
  const entero = (v: unknown, min: number, max: number, def: number) => Math.min(max, Math.max(min, Math.round(Number(v)) || def));

  if (tiene('nombre')) {
    const n = limpiarNombre(d.nombre);
    if (n.length < 2) return err(c, 'Escribe el nombre del negocio.');
    poner('nombre', n);
  }
  if (tiene('marca_titulo')) poner('marca_titulo', limpiarNombre(d.marca_titulo).slice(0, 24));
  if (tiene('marca_subtitulo')) poner('marca_subtitulo', limpiarNombre(d.marca_subtitulo).slice(0, 32));
  if (tiene('logo_con_texto')) poner('logo_con_texto', d.logo_con_texto ? 1 : 0);
  if (tiene('descripcion')) poner('descripcion', texto(d.descripcion, 300));
  if (tiene('direccion')) poner('direccion', texto(d.direccion, 160));
  if (tiene('whatsapp_numero')) {
    const t = d.whatsapp_numero ? normalizarTel(String(d.whatsapp_numero)) : null;
    if (d.whatsapp_numero && !t) return err(c, 'Revisa el WhatsApp de la barbería (8 dígitos).');
    poner('whatsapp_numero', t);
  }
  if (tiene('mapa_url')) {
    const u = enlace(d.mapa_url);
    if (u === undefined) return err(c, 'Revisa el enlace del mapa. Cópialo desde Google Maps → Compartir.');
    poner('mapa_url', u);
  }
  if (tiene('instagram')) {
    const u = usuarioRed(d.instagram);
    if (u === undefined) return err(c, 'Revisa el usuario de Instagram.');
    poner('instagram', u);
  }
  if (tiene('tiktok')) {
    const u = usuarioRed(d.tiktok);
    if (u === undefined) return err(c, 'Revisa el usuario de TikTok.');
    poner('tiktok', u);
  }
  if (tiene('facebook')) {
    const u = paginaFacebook(d.facebook);
    if (u === undefined) return err(c, 'Revisa la página de Facebook.');
    poner('facebook', u);
  }
  if (tiene('horario')) {
    const horario: Record<string, [string, string] | null> = {};
    for (let i = 0; i < 7; i++) {
      const r = d.horario?.[i];
      horario[i] = Array.isArray(r) && hhmm(r[0]) && hhmm(r[1]) && r[0] < r[1] ? [r[0], r[1]] : null;
    }
    poner('horario', JSON.stringify(horario));
  }
  if (tiene('almuerzo')) {
    poner('almuerzo', Array.isArray(d.almuerzo) && hhmm(d.almuerzo[0]) && hhmm(d.almuerzo[1]) && d.almuerzo[0] < d.almuerzo[1]
      ? JSON.stringify([d.almuerzo[0], d.almuerzo[1]]) : null);
  }
  if (tiene('duracion_cita_min')) poner('duracion_cita_min', entero(d.duracion_cita_min, 15, 180, 60));
  if (tiene('tolerancia_min')) poner('tolerancia_min', entero(d.tolerancia_min, 0, 60, 10));
  if (tiene('recargo_l')) poner('recargo_l', Math.min(100000, Math.max(0, Math.round(Number(d.recargo_l)) || 0)));
  if (tiene('dias_anticipacion')) poner('dias_anticipacion', entero(d.dias_anticipacion, 1, 60, 14));
  if (tiene('anticipacion_min')) poner('anticipacion_min', Math.min(1440, Math.max(0, Math.round(Number(d.anticipacion_min)) || 0)));
  if (tiene('agenda_abierta')) poner('agenda_abierta', d.agenda_abierta ? 1 : 0);
  if (tiene('cuentas')) {
    const l = normalizarCuentas(d.cuentas);
    if (typeof l === 'string') return err(c, l);
    poner('cuentas', JSON.stringify(l));
  }

  if (cols.length) await c.env.DB.prepare(`UPDATE barberia SET ${cols.join(', ')} WHERE id = 1`).bind(...vals).run();
  return c.json({ ok: true });
});

app.post('/api/barberos', dueno, async (c) => {
  const s = c.get('sesion');
  const d = await cuerpo(c);
  const nombre = limpiarNombre(d.nombre);
  if (nombre.length < 2) return err(c, 'Escribe el nombre.');
  const pinTexto = d.pin ? String(d.pin) : '';
  if (pinTexto && !/^\d{6}$/.test(pinTexto)) return err(c, 'El PIN debe tener 6 números.');
  const admin = d.es_admin ? 1 : 0;
  const id = Number(d.id) || null;
  const yoMismo = !!id && id === s.barbero_id;
  // Un PIN fácil solo se acepta como temporal (la persona lo cambia al entrar)
  if (pinTexto && (!d.pin_temporal || yoMismo) && (PINES_OBVIOS.has(pinTexto) || /^(\d)\1+$/.test(pinTexto)))
    return err(c, 'Ese PIN es muy fácil de adivinar. Elige otro o márcalo como temporal.');
  if (yoMismo && (!admin || d.activo === false)) return err(c, 'No puedes quitarte tu propio acceso de administrador.');
  const actual = id ? await c.env.DB.prepare('SELECT pin_digitos, pin_hash FROM barberos WHERE id = ?').bind(id).first<any>() : null;
  if (id && !actual) return err(c, 'Esa persona ya no existe.', 404);
  const digitos = pinTexto ? pinTexto.length : actual?.pin_hash ? actual.pin_digitos : 0;
  if (admin && digitos !== 6) return err(c, 'Un administrador necesita un PIN de 6 números. Escríbele uno.');
  const pin = pinTexto ? await hashPin(pinTexto) : null;
  // PIN temporal: quien lo recibe debe crear uno propio al entrar (no aplica a tu propio PIN)
  const temporal = pin && d.pin_temporal && !yoMismo ? 1 : 0;
  const apodo = limpiarNombre(d.apodo) || null;
  const telBarbero = d.telefono ? normalizarTel(String(d.telefono)) : null;
  if (d.telefono && !telBarbero) return err(c, 'Revisa el WhatsApp (8 dígitos).');
  if (id) {
    await c.env.DB.prepare(
      `UPDATE barberos SET nombre = ?, apodo = ?, activo = ?, es_admin = ?, atiende = ?, telefono = ?, pin_hash = COALESCE(?, pin_hash),
         pin_digitos = COALESCE(?, pin_digitos), debe_cambiar_pin = CASE WHEN ? IS NULL THEN debe_cambiar_pin ELSE ? END WHERE id = ?`)
      .bind(nombre, apodo, d.activo === false ? 0 : 1, admin, d.atiende === false ? 0 : 1, telBarbero, pin, pin ? pinTexto.length : null,
        pin, temporal, id).run();
    // Al cambiar PIN o permisos se cierran sus sesiones, salvo la de quien está haciendo el cambio
    const mia = await sha256(c.req.header('authorization')!.replace(/^Bearer /, ''));
    await c.env.DB.prepare('DELETE FROM sesiones WHERE barbero_id = ? AND token_hash != ?').bind(id, mia).run();
    return c.json({ ok: true, id });
  }
  const r = await c.env.DB.prepare(
    `INSERT INTO barberos (nombre, apodo, orden, pin_hash, pin_digitos, es_admin, atiende, telefono, debe_cambiar_pin)
     VALUES (?, ?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM barberos), ?, 6, ?, ?, ?, ?)`)
    .bind(nombre, apodo, pin, admin, d.atiende === false ? 0 : 1, telBarbero, temporal).run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

// Borrar a alguien del equipo: solo si nunca tuvo citas; si las tuvo, se desactiva.
app.delete('/api/barberos/:id', dueno, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('sesion').barbero_id) return err(c, 'No puedes borrarte a ti mismo.');
  const b = await c.env.DB.prepare('SELECT id, foto_key FROM barberos WHERE id = ?').bind(id).first<any>();
  if (!b) return err(c, 'Esa persona ya no existe.', 404);
  const citas = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM citas WHERE barbero_id = ?').bind(id).first<any>();
  if (citas.n) return err(c, `Tiene ${citas.n} cita${citas.n === 1 ? '' : 's'} en el historial. Desactívalo para que ya no aparezca ni pueda entrar.`, 409);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM bloqueos WHERE barbero_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sesiones WHERE barbero_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM suscripciones_push WHERE barbero_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM barberos WHERE id = ?').bind(id),
  ]);
  if (b.foto_key) await c.env.ARCHIVOS?.delete(b.foto_key).catch(() => {});
  return c.json({ ok: true });
});

app.post('/api/servicios', dueno, async (c) => {
  const d = await cuerpo(c);
  const nombre = limpiarNombre(d.nombre);
  const precio = Math.round(Number(d.precio_l));
  if (nombre.length < 2) return err(c, 'Escribe el nombre del servicio.');
  if (d.precio_l === '' || d.precio_l === null || !Number.isFinite(precio) || precio < 0 || precio > 100000) return err(c, 'Escribe un precio válido en lempiras.');
  const desc = texto(d.descripcion, 120);
  const id = Number(d.id) || null;
  if (id) {
    if (d.activo === false && (await ultimoServicio(c, id))) return err(c, 'Debe quedar al menos un servicio visible.');
    await c.env.DB.prepare('UPDATE servicios SET nombre = ?, descripcion = ?, precio_l = ?, activo = ? WHERE id = ?')
      .bind(nombre, desc, precio, d.activo === false ? 0 : 1, id).run();
    return c.json({ ok: true, id });
  }
  const r = await c.env.DB.prepare('INSERT INTO servicios (nombre, descripcion, precio_l, orden) VALUES (?, ?, ?, (SELECT COALESCE(MAX(orden), 0) + 1 FROM servicios))')
    .bind(nombre, desc, precio).run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});

/** ¿Es el único servicio visible? Sin servicios los clientes no pueden agendar. */
async function ultimoServicio(c: C, id: number) {
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM servicios WHERE activo = 1 AND id != ?').bind(id).first<any>();
  const este = await c.env.DB.prepare('SELECT activo FROM servicios WHERE id = ?').bind(id).first<any>();
  return !!este?.activo && r.n === 0;
}

// Las citas guardan su propia copia de servicio y precio, así que borrar un servicio no cambia el historial.
app.delete('/api/servicios/:id', dueno, async (c) => {
  const id = Number(c.req.param('id'));
  if (await ultimoServicio(c, id)) return err(c, 'Debe quedar al menos un servicio visible.');
  await c.env.DB.prepare('DELETE FROM servicios WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// Mover un servicio o una persona del equipo arriba o abajo en la lista
app.post('/api/orden', dueno, async (c) => {
  const d = await cuerpo(c);
  const tabla = d.tipo === 'barberos' ? 'barberos' : d.tipo === 'servicios' ? 'servicios' : null;
  const ids = Array.isArray(d.ids) ? d.ids.map(Number).filter(Boolean).slice(0, 200) : [];
  if (!tabla || !ids.length) return err(c, 'Datos incompletos.');
  await c.env.DB.batch(ids.map((id: number, i: number) => c.env.DB.prepare(`UPDATE ${tabla} SET orden = ? WHERE id = ?`).bind(i + 1, id)));
  return c.json({ ok: true });
});

// Foto de barbero o logo en R2. La web reduce la imagen en el teléfono antes de subirla.
app.post('/api/archivos', dueno, async (c) => {
  if (!c.env.ARCHIVOS) return err(c, 'El almacenamiento de imágenes (R2) no está configurado.');
  const tipo = (c.req.header('content-type') ?? '').split(';')[0].trim();
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[tipo];
  if (!ext) return err(c, 'Sube una imagen JPG, PNG o WebP.');
  const datos = await c.req.arrayBuffer();
  if (!datos.byteLength) return err(c, 'La imagen está vacía.');
  if (datos.byteLength > 2 * 1024 * 1024) return err(c, 'La imagen pesa más de 2 MB.');
  const barbero = Number(c.req.query('barbero')) || null;
  const antes = barbero
    ? await c.env.DB.prepare('SELECT foto_key AS k FROM barberos WHERE id = ?').bind(barbero).first<any>()
    : await c.env.DB.prepare('SELECT logo_key AS k FROM barberia WHERE id = 1').first<any>();
  if (barbero && !antes) return err(c, 'Esa persona ya no existe.', 404);
  const clave = `${barbero ? `barberos/${barbero}` : 'logo'}-${aleatorioHex(4)}.${ext}`;
  await c.env.ARCHIVOS.put(clave, datos, { httpMetadata: { contentType: tipo } });
  if (barbero) await c.env.DB.prepare('UPDATE barberos SET foto_key = ? WHERE id = ?').bind(clave, barbero).run();
  else await c.env.DB.prepare('UPDATE barberia SET logo_key = ? WHERE id = 1').bind(clave).run();
  if (antes?.k) await c.env.ARCHIVOS.delete(antes.k).catch(() => {});
  return c.json({ clave });
});

// Quitar el logo subido (vuelve el emblema original) o la foto de un barbero
app.delete('/api/archivos', dueno, async (c) => {
  const barbero = Number(c.req.query('barbero')) || null;
  const antes = barbero
    ? await c.env.DB.prepare('SELECT foto_key AS k FROM barberos WHERE id = ?').bind(barbero).first<any>()
    : await c.env.DB.prepare('SELECT logo_key AS k FROM barberia WHERE id = 1').first<any>();
  if (barbero) await c.env.DB.prepare('UPDATE barberos SET foto_key = NULL WHERE id = ?').bind(barbero).run();
  else await c.env.DB.prepare('UPDATE barberia SET logo_key = NULL WHERE id = 1').run();
  if (antes?.k) await c.env.ARCHIVOS?.delete(antes.k).catch(() => {});
  return c.json({ ok: true });
});

// ---------- Dueño: usuarios que entran con correo ----------
app.get('/api/usuarios', dueno, async (c) => {
  const s = c.get('sesion');
  const principales = emailsDueno(c.env);
  const filas = (await c.env.DB.prepare(
    `SELECT u.id, u.email, u.nombre, u.creado_en, (SELECT COUNT(*) FROM passkeys p WHERE p.usuario_id = u.id) AS passkeys
     FROM usuarios u ORDER BY u.id`).all<any>()).results;
  const usuarios = filas.map((u) => ({ ...u, principal: principales.includes(u.email), yo: u.id === s.usuario_id }));
  // Correos principales que aún no han entrado nunca
  for (const email of principales) if (!filas.some((u) => u.email === email)) usuarios.unshift({ id: null, email, nombre: null, creado_en: null, passkeys: 0, principal: true, yo: false });
  return c.json({ usuarios });
});

app.post('/api/usuarios', dueno, async (c) => {
  const d = await cuerpo(c);
  const email = String(d.email ?? '').toLowerCase().trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 120) return err(c, 'Escribe un correo válido.');
  const nombre = limpiarNombre(d.nombre) || null;
  const ya = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(email).first<any>();
  if (ya) {
    await c.env.DB.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').bind(nombre, ya.id).run();
    return c.json({ ok: true, id: ya.id, invitado: false });
  }
  const r = await c.env.DB.prepare('INSERT INTO usuarios (email, nombre, creado_en) VALUES (?, ?, ?)').bind(email, nombre, utc()).run();
  let invitado = false;
  if (c.env.RESEND_API_KEY) {
    const n = (await c.env.DB.prepare('SELECT nombre FROM barberia WHERE id = 1').first<any>())?.nombre ?? 'la barbería';
    const web = (c.env.WEB_URL ?? origenes(c.env)[0]).replace(/\/$/, '');
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: c.env.RESEND_FROM, to: [email], subject: `Tienes acceso al panel de ${n}`,
        html: `<div style="font-family:sans-serif;max-width:420px"><h2>${escaparHtml(n)}</h2><p>Hola${nombre ? ` ${escaparHtml(nombre)}` : ''}, ya puedes entrar al panel del dueño.</p><p><a href="${web}/dueno" style="display:inline-block;background:#e23a3a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Entrar al panel</a></p><p>Escribe este correo y te llegará un código de 6 números.</p></div>`,
      }),
    }).catch(() => null);
    invitado = !!r2?.ok;
  }
  return c.json({ ok: true, id: r.meta.last_row_id, invitado });
});

app.delete('/api/usuarios/:id', dueno, async (c) => {
  const id = Number(c.req.param('id'));
  const u = await c.env.DB.prepare('SELECT id, email FROM usuarios WHERE id = ?').bind(id).first<any>();
  if (!u) return err(c, 'Ese usuario ya no existe.', 404);
  if (id === c.get('sesion').usuario_id) return err(c, 'No puedes quitarte a ti mismo.');
  if (emailsDueno(c.env).includes(u.email)) return err(c, 'Este es el correo principal del dueño y no se puede quitar desde aquí.', 409);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM passkeys WHERE usuario_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM codigos_login WHERE email = ?').bind(u.email),
    c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

// ---------- Dueño: métricas y clientes ----------
app.get('/api/metricas', dueno, async (c) => {
  const hoy = ahoraLocal().slice(0, 10);
  const rango = c.req.query('rango') ?? 'hoy';
  const desde = rango === 'mes' ? sumarDias(hoy, -29) : rango === 'semana' ? sumarDias(hoy, -6) : hoy;
  const citas = (await c.env.DB.prepare(
    `SELECT c.barbero_id, b.nombre AS barbero, c.inicio, c.estado, c.servicios, c.total_l, c.recargo_l, c.llego_en
     FROM citas c JOIN barberos b ON b.id = c.barbero_id WHERE c.inicio >= ? AND c.inicio < ?`)
    .bind(desde, sumarDias(hoy, 1)).all<any>()).results;
  const porBarbero: Record<string, any> = {}, porServicio: Record<string, any> = {}, porHora: Record<string, number> = {};
  let atendidas = 0, noLlego = 0, canceladas = 0, ingresos = 0, recargos = 0, sumaRetraso = 0, maxRetraso = 0, conRetraso = 0;
  for (const x of citas) {
    const pb = (porBarbero[x.barbero] ??= { barbero: x.barbero, atendidas: 0, no_llego: 0, ingresos_l: 0 });
    if (x.estado === 'terminada') {
      atendidas++; pb.atendidas++; pb.ingresos_l += x.total_l; ingresos += x.total_l; recargos += x.recargo_l;
      const h = x.inicio.slice(11, 13); porHora[h] = (porHora[h] ?? 0) + 1;
      for (const s of JSON.parse(x.servicios)) {
        const ps = (porServicio[s.nombre] ??= { servicio: s.nombre, cantidad: 0, ingresos_l: 0 });
        ps.cantidad++; ps.ingresos_l += s.precio_l;
      }
      if (x.llego_en) { const r = Math.max(0, minutosEntre(x.inicio, x.llego_en)); sumaRetraso += r; maxRetraso = Math.max(maxRetraso, r); conRetraso++; }
    } else if (x.estado === 'no_llego') { noLlego++; pb.no_llego++; }
    else if (x.estado === 'cancelada') canceladas++;
  }
  return c.json({
    rango, desde, hasta: hoy, atendidas, no_llego: noLlego, canceladas, ingresos_l: ingresos, recargos_l: recargos,
    pendientes: citas.filter((x) => x.estado === 'agendada').length,
    retraso_promedio_min: conRetraso ? Math.round(sumaRetraso / conRetraso) : 0, retraso_max_min: maxRetraso,
    por_barbero: Object.values(porBarbero), por_servicio: Object.values(porServicio),
    por_hora: Object.entries(porHora).sort().map(([hora, cantidad]) => ({ hora, cantidad })),
  });
});

app.get('/api/clientes', dueno, async (c) => {
  const filas = (await c.env.DB.prepare(
    `SELECT id, nombre, telefono, consentimiento, wa_verificado, visitas, no_llegadas, ultima_cita FROM clientes
     ORDER BY COALESCE(ultima_cita, creado_en) DESC LIMIT 1000`).all<any>()).results;
  if (c.req.query('formato') !== 'csv') return c.json({ clientes: filas });
  const celda = (v: unknown) => { const t = String(v ?? ''); return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`; };
  const csv = ['Nombre,Teléfono,Acepta avisos,WhatsApp verificado,Visitas,No llegó,Última cita',
    ...filas.map((f) => [f.nombre, f.telefono, f.consentimiento ? 'sí' : 'no', f.wa_verificado ? 'sí' : 'no', f.visitas, f.no_llegadas, f.ultima_cita].map(celda).join(','))].join('\n');
  return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="clientes-olimpo.csv"' } });
});

// ---------- Registro de uso (clics) ----------
app.post('/api/eventos', async (c) => {
  const d = await cuerpo(c);
  const dispositivo = String(d.dispositivo ?? '').slice(0, 64);
  const eventos = Array.isArray(d.eventos) ? d.eventos.slice(0, 40) : [];
  if (!dispositivo || !eventos.length) return c.json({ ok: true });
  const s = await leerSesion(c);
  let usuario: string | null = null;
  if (s?.barbero_id) usuario = (await c.env.DB.prepare('SELECT nombre FROM barberos WHERE id = ?').bind(s.barbero_id).first<any>())?.nombre ?? null;
  else if (s) usuario = 'Dueño';
  const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const ahora = Date.now();
  await c.env.DB.batch(eventos.map((e: any) => {
    // La hora la pone el servidor; el cliente solo indica hace cuánto ocurrió (máx. 10 min)
    const hace = Math.min(600000, Math.max(0, Number(e?.hace_ms) || 0));
    return c.env.DB.prepare('INSERT INTO eventos_clic (dispositivo, usuario, ruta, elemento, creado_en) VALUES (?,?,?,?,?)')
      .bind(dispositivo, usuario, texto(e?.ruta, 80) || '/', texto(e?.elemento, 80) || '(sin texto)', new Date(ahora - hace).toISOString());
  }));
  return c.json({ ok: true });
});

app.get('/api/eventos/resumen', dueno, async (c) => {
  const dias = c.req.query('rango') === 'semana' ? 7 : c.req.query('rango') === 'mes' ? 30 : 1;
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const quien = c.req.query('quien') ?? '';
  const filtro = quien ? `AND COALESCE(usuario, dispositivo) = ?2` : '';
  const args = quien ? [desde, quien] : [desde];
  const [porQuien, top, recientes, total] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(usuario, dispositivo) AS quien, usuario, COUNT(DISTINCT dispositivo) AS dispositivos, COUNT(*) AS clics, MAX(creado_en) AS ultimo
       FROM eventos_clic WHERE creado_en >= ?1 GROUP BY quien ORDER BY ultimo DESC LIMIT 200`).bind(desde).all<any>(),
    c.env.DB.prepare(`SELECT elemento, ruta, COUNT(*) AS clics FROM eventos_clic WHERE creado_en >= ?1 ${filtro} GROUP BY elemento, ruta ORDER BY clics DESC LIMIT 30`).bind(...args).all<any>(),
    c.env.DB.prepare(`SELECT COALESCE(usuario, dispositivo) AS quien, usuario, ruta, elemento, creado_en FROM eventos_clic WHERE creado_en >= ?1 ${filtro} ORDER BY id DESC LIMIT 150`).bind(...args).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS clics, COUNT(DISTINCT dispositivo) AS dispositivos FROM eventos_clic WHERE creado_en >= ?1`).bind(desde).first<any>(),
  ]);
  return c.json({ total, por_quien: porQuien.results, top: top.results, recientes: recientes.results });
});

// ---------- WhatsApp ----------
app.get('/api/whatsapp/webhook', (c) => {
  const q = c.req.query();
  if (q['hub.mode'] === 'subscribe' && c.env.WA_VERIFY_TOKEN && q['hub.verify_token'] === c.env.WA_VERIFY_TOKEN) return c.text(q['hub.challenge'] ?? '');
  return c.text('No autorizado', 403);
});
app.post('/api/whatsapp/webhook', async (c) => {
  const crudo = await c.req.text();
  if (!(await firmaValida(c.env, crudo, c.req.header('x-hub-signature-256')))) return c.text('Firma inválida', 401);
  c.executionCtx.waitUntil(manejarWebhook(c.env, JSON.parse(crudo)).catch((e) => console.error('webhook', e)));
  return c.text('ok');
});
app.get('/api/whatsapp/estado', dueno, async (c) => {
  const mensajes = (await c.env.DB.prepare('SELECT * FROM whatsapp_mensajes ORDER BY id DESC LIMIT 60').all()).results;
  return c.json({
    modo: waConfigurado(c.env) ? 'real' : 'simulado', webhook_listo: !!(c.env.WA_VERIFY_TOKEN && c.env.WA_APP_SECRET),
    plantilla_recordatorio: c.env.WA_PLANTILLA_RECORDATORIO ?? null, mensajes,
  });
});
app.post('/api/whatsapp/prueba', dueno, async (c) => {
  const d = await cuerpo(c);
  const tel = normalizarTel(d.telefono);
  if (!tel) return err(c, 'Revisa el número (8 dígitos).');
  const estado = await enviarWA(c.env, tel, String(d.texto || `Prueba de TurnoYa · ${await nombreNegocio(c.env)} ✂️`).slice(0, 500), { tipo: 'prueba' });
  return c.json({ estado });
});
app.post('/api/whatsapp/simular', dueno, async (c) => {
  const d = await cuerpo(c);
  if (!normalizarTel(d.telefono)) return err(c, 'Revisa el número (8 dígitos).');
  return c.json(await procesarEntrante(c.env, d.telefono, String(d.texto ?? '').slice(0, 500), undefined, 'Cliente'));
});

app.notFound((c) => c.json({ error: 'No encontrado' }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledController, env: Env) {
    const ahora = ahoraLocal();
    await tareasProgramadas(env, ahora, sumarMin(ahora, 65), sumarDias(ahora.slice(0, 10), -90));
  },
};
