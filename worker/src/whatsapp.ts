import { Env, utc, RE_CODIGO, fechaTexto, normalizarTel } from './lib';

export const waConfigurado = (env: Env) => !!(env.WA_TOKEN && env.WA_PHONE_ID);

async function registrar(env: Env, m: { direccion: string; telefono: string; texto: string; tipo?: string;
  estado: string; wa_id?: string | null; detalle?: string | null; cita_id?: number | null }) {
  await env.DB.prepare(
    `INSERT INTO whatsapp_mensajes (direccion, telefono, texto, tipo, estado, wa_id, detalle, cita_id, creado_en)
     VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(m.direccion, m.telefono, m.texto, m.tipo ?? 'texto', m.estado, m.wa_id ?? null, m.detalle ?? null, m.cita_id ?? null, utc()).run();
}

async function llamarMeta(env: Env, cuerpo: unknown) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const j: any = await r.json().catch(() => ({}));
  return { ok: r.ok, wa_id: j?.messages?.[0]?.id ?? null, detalle: r.ok ? null : JSON.stringify(j?.error ?? j).slice(0, 500) };
}

/**
 * Envía un aviso. Dentro de la ventana de 24 h (el cliente escribió primero) va como texto libre.
 * Fuera de la ventana solo se puede con plantilla aprobada (opts.plantilla); si no hay, queda 'fuera_de_ventana'.
 * Sin credenciales de Meta todo queda como 'simulado' en la bitácora.
 */
export async function enviarWA(env: Env, telefono: string, texto: string,
  opts: { cita_id?: number; tipo?: string; forzar?: boolean; plantilla?: { nombre: string; parametros: string[] } } = {}) {
  const cli = await env.DB.prepare('SELECT ultimo_entrante_en FROM clientes WHERE telefono = ?').bind(telefono).first<any>();
  const enVentana = opts.forzar ||
    (cli?.ultimo_entrante_en && Date.now() - Date.parse(cli.ultimo_entrante_en) < 24 * 3600e3);
  const base = { direccion: 'saliente', telefono, texto, tipo: opts.tipo ?? 'aviso', cita_id: opts.cita_id ?? null };
  if (!enVentana && !opts.plantilla) {
    await registrar(env, { ...base, estado: 'fuera_de_ventana', detalle: 'El cliente no ha escrito en las últimas 24 h y no hay plantilla configurada' });
    return 'fuera_de_ventana';
  }
  if (!waConfigurado(env)) {
    await registrar(env, { ...base, estado: 'simulado', detalle: enVentana ? 'texto' : `plantilla ${opts.plantilla!.nombre}` });
    return 'simulado';
  }
  const cuerpo = enVentana
    ? { messaging_product: 'whatsapp', to: telefono, type: 'text', text: { body: texto } }
    : { messaging_product: 'whatsapp', to: telefono, type: 'template',
        template: { name: opts.plantilla!.nombre, language: { code: 'es' },
          components: [{ type: 'body', parameters: opts.plantilla!.parametros.map((text) => ({ type: 'text', text })) }] } };
  const r = await llamarMeta(env, cuerpo);
  await registrar(env, { ...base, estado: r.ok ? 'enviado' : 'error', wa_id: r.wa_id, detalle: r.detalle });
  return r.ok ? 'enviado' : 'error';
}

/** Procesa un mensaje entrante (real o simulado): abre la ventana de 24 h y vincula el teléfono a la cita. */
export async function procesarEntrante(env: Env, telefonoCrudo: string, texto: string, waId?: string, nombrePerfil?: string) {
  const telefono = normalizarTel(telefonoCrudo);
  if (!telefono) return { vinculada: false };
  await registrar(env, { direccion: 'entrante', telefono, texto, estado: 'recibido', wa_id: waId });
  await env.DB.prepare(
    `INSERT INTO clientes (telefono, nombre, consentimiento, wa_verificado, ultimo_entrante_en, creado_en)
     VALUES (?1, ?2, 1, 1, ?3, ?3)
     ON CONFLICT(telefono) DO UPDATE SET wa_verificado = 1, consentimiento = 1, ultimo_entrante_en = ?3`)
    .bind(telefono, nombrePerfil || 'Cliente', utc()).run();
  const cli = await env.DB.prepare('SELECT id FROM clientes WHERE telefono = ?').bind(telefono).first<any>();
  // El mensaje puede traer otras palabras de 5 letras ("BARBA", "CEJAS"): se prueba cada una hasta dar con un código real
  const candidatos = [...new Set(texto.toUpperCase().match(new RegExp(RE_CODIGO.source, 'g')) ?? [])].slice(0, 8);
  let cita: any = null;
  for (const cod of candidatos.reverse()) {
    cita = await env.DB.prepare(
      `SELECT c.*, b.nombre AS barbero FROM citas c JOIN barberos b ON b.id = c.barbero_id WHERE c.codigo = ?`).bind(cod).first<any>();
    if (cita) break;
  }
  if (!cita) {
    if (/^\s*(baja|stop|alto)\s*$/i.test(texto)) {
      await env.DB.prepare('UPDATE clientes SET consentimiento = 0 WHERE id = ?').bind(cli.id).run();
      await enviarWA(env, telefono, 'Listo, ya no te enviaremos avisos. Escribe cuando quieras para reactivarlos.', { tipo: 'baja' });
    } else {
      await enviarWA(env, telefono, 'Hola 👋 Somos Olimpo Barber Club. Para recibir avisos de tu cita envíanos el código de 5 letras que te dio TurnoYa.', { tipo: 'ayuda' });
    }
    return { vinculada: false };
  }
  await env.DB.prepare('UPDATE citas SET telefono = ?, cliente_id = ? WHERE id = ?').bind(telefono, cli.id, cita.id).run();
  await env.DB.prepare(`UPDATE clientes SET nombre = ? WHERE id = ? AND nombre = 'Cliente'`).bind(cita.nombre, cli.id).run();
  await enviarWA(env, telefono,
    `¡Listo, ${cita.nombre.split(' ')[0]}! Te avisaremos por aquí. Tu cita en Olimpo Barber Club es ${fechaTexto(cita.inicio)} con ${cita.barbero}. Llega puntual: hay 10 min de tolerancia.`,
    { cita_id: cita.id, tipo: 'confirmacion' });
  return { vinculada: true, codigo: cita.codigo };
}

/** Se liberó una hora: se la ofrece a quienes tienen cita más tarde ese mismo día. */
export async function ofrecerHora(env: Env, inicio: string, ahora: string) {
  if (inicio <= ahora) return;
  const citas = (await env.DB.prepare(
    `SELECT c.id, c.nombre, c.telefono, c.codigo FROM citas c LEFT JOIN clientes k ON k.id = c.cliente_id
     WHERE c.estado = 'agendada' AND c.telefono IS NOT NULL AND COALESCE(k.consentimiento, 1) = 1
       AND c.inicio > ?1 AND c.inicio LIKE ?2 ORDER BY c.inicio LIMIT 5`).bind(inicio, inicio.slice(0, 10) + '%').all<any>()).results;
  const enlace = (codigo: string) => (env.WEB_URL ? ` ${env.WEB_URL.replace(/\/$/, '')}/c/${codigo}` : '');
  for (const c of citas) {
    await enviarWA(env, c.telefono,
      `${c.nombre.split(' ')[0]}, se liberó una hora en Olimpo Barber Club: ${fechaTexto(inicio)}. Si quieres adelantar tu cita, ábrela y toca "Cambiar hora".${enlace(c.codigo)} La toma el primero que la elija.`,
      { cita_id: c.id, tipo: 'hora_libre' });
  }
}

/** Verifica la firma X-Hub-Signature-256 de Meta. */
export async function firmaValida(env: Env, cuerpo: string, firma: string | undefined) {
  if (!env.WA_APP_SECRET) return env.ENTORNO === 'dev';
  if (!firma?.startsWith('sha256=')) return false;
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.WA_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo));
  const esperado = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const dado = firma.slice(7);
  if (dado.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < dado.length; i++) dif |= dado.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

export async function manejarWebhook(env: Env, datos: any) {
  for (const entrada of datos?.entry ?? []) for (const cambio of entrada?.changes ?? []) {
    const v = cambio?.value ?? {};
    for (const m of v.messages ?? []) {
      const texto = m.text?.body ?? m.button?.text ?? '';
      const perfil = v.contacts?.find((c: any) => c.wa_id === m.from)?.profile?.name;
      const visto = await env.DB.prepare('SELECT 1 FROM whatsapp_mensajes WHERE wa_id = ?').bind(m.id).first();
      if (!visto) await procesarEntrante(env, m.from, texto, m.id, perfil);
    }
    for (const s of v.statuses ?? []) {
      const estado = ({ sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'error' } as any)[s.status];
      if (estado) await env.DB.prepare('UPDATE whatsapp_mensajes SET estado = ?, detalle = COALESCE(?, detalle) WHERE wa_id = ?')
        .bind(estado, s.errors ? JSON.stringify(s.errors).slice(0, 500) : null, s.id).run();
    }
  }
}

/** Cron: recordatorio ~1 h antes y borrado de teléfonos a los 90 días. */
export async function tareasProgramadas(env: Env, ahora: string, limite: string, hace90: string) {
  const citas = (await env.DB.prepare(
    `SELECT c.id, c.nombre, c.telefono, c.inicio, b.nombre AS barbero, k.consentimiento
     FROM citas c JOIN barberos b ON b.id = c.barbero_id LEFT JOIN clientes k ON k.id = c.cliente_id
     WHERE c.estado = 'agendada' AND c.recordatorio_enviado = 0 AND c.telefono IS NOT NULL
       AND c.inicio > ? AND c.inicio <= ?`).bind(ahora, limite).all<any>()).results;
  for (const c of citas) {
    await env.DB.prepare('UPDATE citas SET recordatorio_enviado = 1 WHERE id = ?').bind(c.id).run();
    if (c.consentimiento === 0) continue;
    const nombre = c.nombre.split(' ')[0];
    const cuando = fechaTexto(c.inicio);
    await enviarWA(env, c.telefono,
      `${nombre}, tu cita en Olimpo Barber Club es ${cuando} con ${c.barbero}. Llega puntual: después de 10 min se pierde la hora.`,
      { cita_id: c.id, tipo: 'recordatorio',
        plantilla: env.WA_PLANTILLA_RECORDATORIO ? { nombre: env.WA_PLANTILLA_RECORDATORIO, parametros: [nombre, cuando, c.barbero] } : undefined });
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE citas SET telefono = NULL WHERE telefono IS NOT NULL AND inicio < ?`).bind(hace90),
    env.DB.prepare(`UPDATE clientes SET telefono = NULL WHERE telefono IS NOT NULL AND COALESCE(ultima_cita, creado_en) < ?`).bind(hace90),
    env.DB.prepare(`DELETE FROM whatsapp_mensajes WHERE creado_en < ?`).bind(hace90),
    env.DB.prepare(`DELETE FROM intentos WHERE cuando < ?`).bind(hace90),
    env.DB.prepare(`DELETE FROM sesiones WHERE expira_en < ?`).bind(new Date().toISOString()),
  ]);
}
