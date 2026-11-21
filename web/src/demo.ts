// Modo demostración: cuando la web se publica sin API (VITE_API_URL vacío), todo corre en el navegador
// con datos de ejemplo guardados en este dispositivo. Sirve para ver el diseño y el flujo; nada es real.
type R = { estado: number; datos: any };
const ok = (datos: any): R => ({ estado: 200, datos });
const mal = (error: string, estado = 409, extra: object = {}): R => ({ estado, datos: { error, ...extra } });

const ahora = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 16);
const sumarMin = (l: string, m: number) => new Date(Date.parse(l + ':00Z') + m * 60e3).toISOString().slice(0, 16);
const sumarDias = (f: string, d: number) => new Date(Date.parse(f + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
const pub = (n: string) => { const p = n.trim().split(/\s+/); const c = (s: string) => s[0].toUpperCase() + s.slice(1); return p[1] ? `${c(p[0])} ${p[1][0].toUpperCase()}.` : c(p[0]); };
const codigo = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const tel = (t?: string) => { const d = (t ?? '').replace(/\D/g, ''); return d.length === 8 ? '504' + d : null; };

function nuevo() {
  const a = ahora(), hoy = a.slice(0, 10), h = (n: number) => `${hoy}T${String(Math.min(23, Math.max(0, Number(a.slice(11, 13)) + n))).padStart(2, '0')}:00`;
  const S = [{ id: 1, nombre: 'Corte', descripcion: 'Corte de cabello a tu estilo', precio_l: 150, orden: 1, activo: 1 },
    { id: 2, nombre: 'Barba', descripcion: 'Perfilado y arreglo de barba', precio_l: 100, orden: 2, activo: 1 },
    { id: 3, nombre: 'Cejas', descripcion: 'Limpieza y diseño de cejas', precio_l: 50, orden: 3, activo: 1 }];
  const sv = (...ids: number[]) => S.filter((s) => ids.includes(s.id)).map(({ id, nombre, precio_l }) => ({ id, nombre, precio_l }));
  const cita = (id: number, cod: string, barbero_id: number, inicio: string, estado: string, nombre: string, ids: number[], telefono: string | null = null, extra: object = {}) => {
    const servicios = sv(...ids);
    return { id, codigo: cod, barbero_id, inicio, estado, nombre, nombre_publico: pub(nombre), telefono, dispositivo: null, servicios, total_l: servicios.reduce((t, s) => t + s.precio_l, 0), recargo_l: 0, origen: 'web', recuperada: 0, llego_en: null as string | null, terminado_en: null, no_llegadas: 0, visitas: 0, ...extra };
  };
  // Mismo horario que la barbería real: lunes a sábado de 10 a.m. a 9 p.m., almuerzo de 12 a 1
  const horario = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, d === 0 ? null : ['10:00', '21:00']]));
  return {
    dia: hoy, sig: 20,
    barberia: { id: 1, nombre: 'Olimpo Barber Club', direccion: 'Quimistán, Santa Bárbara', whatsapp_numero: '50499990000', horario, almuerzo: ['12:00', '13:00'] as [string, string] | null,
      duracion_cita_min: 60, tolerancia_min: 10, recargo_l: 50, dias_anticipacion: 14, anticipacion_min: 60, agenda_abierta: 1, logo_key: null as string | null,
      marca_titulo: 'OLIMPO', marca_subtitulo: 'BARBER CLUB', logo_con_texto: 1, descripcion: '', mapa_url: null as string | null,
      instagram: null as string | null, facebook: null as string | null, tiktok: null as string | null },
    barberos: [{ id: 1, nombre: 'Edison', apodo: null as string | null, foto_key: null as string | null, orden: 1, activo: 1, con_pin: 1, es_admin: 1, pin_digitos: 6, atiende: 1, debe_cambiar_pin: 0, telefono: null as string | null },
      { id: 2, nombre: 'Kevin Mejía', apodo: 'Kevin', foto_key: null, orden: 2, activo: 1, con_pin: 1, es_admin: 0, pin_digitos: 6, atiende: 1, debe_cambiar_pin: 0, telefono: null }],
    usuarios: [{ id: 1, email: 'dueno@ejemplo.com', nombre: 'Dueño', creado_en: '2026-01-01', passkeys: 0, principal: true }] as any[],
    servicios: S,
    citas: [
      cita(1, 'DEMA2', 1, h(-2), 'terminada', 'Marlon Pineda', [1], null, { llego_en: sumarMin(h(-2), 3) }),
      cita(2, 'DEMB3', 1, h(-1), 'agendada', 'Josué Rivera', [1, 3]),
      cita(3, 'DEMC4', 1, h(0), 'en_atencion', 'Óscar López', [1, 2], '50433112233', { llego_en: sumarMin(h(0), 2), visitas: 3 }),
      cita(4, 'DEMD5', 1, h(1), 'agendada', 'Kenia Andino', [3], '50498765432', { visitas: 1 }),
      cita(5, 'DEME6', 2, h(1), 'agendada', 'Daniel Flores', [2], null, { origen: 'manual' }),
      cita(6, 'DEMF7', 2, h(-3), 'no_llego', 'Wilmer Zelaya', [1]),
    ] as any[],
    bloqueos: [] as { barbero_id: number; inicio: string }[],
    clientes: [{ id: 1, nombre: 'Óscar López', telefono: '50433112233', consentimiento: 1, wa_verificado: 1, visitas: 3, no_llegadas: 0, ultima_cita: hoy },
      { id: 2, nombre: 'Kenia Andino', telefono: '50498765432', consentimiento: 1, wa_verificado: 0, visitas: 1, no_llegadas: 0, ultima_cita: hoy }] as any[],
    mensajes: [] as any[],
  };
}
type Estado = ReturnType<typeof nuevo>;
let E: Estado;
function cargar() {
  try { const g = JSON.parse(localStorage.getItem('ty_demo2') ?? 'null'); if (g?.dia === ahora().slice(0, 10)) { E = g; return; } } catch { /* se regenera */ }
  E = nuevo();
}
const guardar = () => { try { localStorage.setItem('ty_demo2', JSON.stringify(E)); } catch { /* sin almacenamiento */ } };

const VIVOS = ['agendada', 'en_atencion', 'terminada'];
function disponibilidad(fecha: string, sinAnticipacion = false) {
  const b = E.barberia, a = ahora(), hoy = a.slice(0, 10);
  if (fecha < hoy || fecha > sumarDias(hoy, b.dias_anticipacion)) return [];
  const r = (b.horario as any)[new Date(fecha + 'T00:00:00Z').getUTCDay()] as [string, string] | null;
  if (!r) return [];
  const desde = sumarMin(a, sinAnticipacion ? 0 : b.anticipacion_min), horas = [];
  for (let t = `${fecha}T${r[0]}`; sumarMin(t, b.duracion_cita_min) <= `${fecha}T${r[1]}`; t = sumarMin(t, b.duracion_cita_min)) {
    if (b.almuerzo && t < `${fecha}T${b.almuerzo[1]}` && sumarMin(t, b.duracion_cita_min) > `${fecha}T${b.almuerzo[0]}`) continue;
    const libres = t > a && t >= desde ? E.barberos.filter((x) => x.activo && !E.citas.some((c) => c.barbero_id === x.id && c.inicio === t && VIVOS.includes(c.estado))
      && !E.bloqueos.some((q) => q.barbero_id === x.id && q.inicio === t)).map((x) => x.id) : [];
    horas.push({ inicio: t, hora: t.slice(11), barberos: libres });
  }
  return horas;
}
function crear(d: any, manual = false, extra: object = {}): R {
  const hora = disponibilidad(String(d.inicio).slice(0, 10), manual).find((h) => h.inicio === d.inicio);
  const barbero = d.barbero_id ? (hora?.barberos.includes(Number(d.barbero_id)) ? Number(d.barbero_id) : null) : hora?.barberos[0];
  if (!barbero) return mal('Esa hora ya se ocupó. Elige otra.');
  const servicios = E.servicios.filter((s) => (d.servicios ?? []).includes(s.id)).map(({ id, nombre, precio_l }) => ({ id, nombre, precio_l }));
  if (!servicios.length) return mal('Elige al menos un servicio.');
  const nombre = String(d.nombre ?? '').trim();
  if (nombre.length < 2) return mal('Escribe tu nombre.', 400);
  const c = { id: E.sig++, codigo: codigo(), barbero_id: barbero, inicio: d.inicio, estado: 'agendada', nombre, nombre_publico: pub(nombre), telefono: tel(d.telefono), dispositivo: d.dispositivo ?? null,
    servicios, total_l: servicios.reduce((t, s) => t + s.precio_l, 0), recargo_l: 0, origen: manual ? 'manual' : 'web', recuperada: 0, llego_en: null, terminado_en: null, no_llegadas: 0, visitas: 0, ...extra } as any;
  c.total_l += c.recargo_l;
  E.citas.push(c);
  if (c.telefono && !E.clientes.some((k) => k.telefono === c.telefono)) E.clientes.unshift({ id: E.sig++, nombre, telefono: c.telefono, consentimiento: 1, wa_verificado: 0, visitas: 0, no_llegadas: 0, ultima_cita: c.inicio.slice(0, 10) });
  return ok({ codigo: c.codigo });
}
const nombreBarbero = (id: number) => E.barberos.find((b) => b.id === id)!;
const wa = (direccion: string, telefono: string, texto: string, estado: string) => E.mensajes.unshift({ id: E.sig++, direccion, telefono, texto, estado });

export function demoApi(ruta: string, d: any, metodo: string, token: string | null): R {
  cargar();
  const r = responder(ruta, d ?? {}, metodo, token);
  guardar();
  return r;
}

function responder(rutaCompleta: string, d: any, metodo: string, token: string | null): R {
  const [ruta, q = ''] = rutaCompleta.split('?');
  const p = new URLSearchParams(q), a = ahora(), hoy = a.slice(0, 10);
  const rol = token?.startsWith('demo-dueno') ? 'dueno' : token?.startsWith('demo-barbero-') ? 'barbero' : null;
  const miBarbero = rol === 'barbero' ? Number(token!.split('-')[2]) : null;
  let m: RegExpMatchArray | null;

  if (ruta === '/barberia' && metodo === 'GET') {
    let proxima: string | null = null;
    for (let i = 0; i <= 7 && !proxima; i++) proxima = disponibilidad(sumarDias(hoy, i)).find((h) => h.barberos.length)?.inicio ?? null;
    const orden = (x: any, y: any) => x.orden - y.orden;
    return ok({ barberia: E.barberia, barberos: E.barberos.filter((b) => b.activo && b.atiende !== 0).sort(orden), personal: E.barberos.filter((b) => b.activo && b.con_pin).sort(orden),
      servicios: E.servicios.filter((s) => s.activo).sort(orden), proxima_libre: E.barberia.agenda_abierta ? proxima : null, ahora: a, version: 2 });
  }
  if (ruta === '/marca') { const b = E.barberia; return ok({ nombre: b.nombre, marca_titulo: b.marca_titulo, marca_subtitulo: b.marca_subtitulo, logo_key: b.logo_key, logo_con_texto: b.logo_con_texto, version: 2 }); }
  if (ruta === '/disponibilidad') return ok({ fecha: p.get('fecha') ?? hoy, horas: disponibilidad(p.get('fecha') ?? hoy) });
  if (ruta === '/pantalla') return ok({ barberia: E.barberia, ahora: a, citas: E.citas.filter((c) => c.inicio.startsWith(hoy) && ['agendada', 'en_atencion'].includes(c.estado)).sort((x, y) => x.inicio.localeCompare(y.inicio)).map((c) => ({ inicio: c.inicio, estado: c.estado, nombre_publico: c.nombre_publico, barbero: nombreBarbero(c.barbero_id).nombre })) });

  if (ruta === '/citas' && metodo === 'POST') {
    if (!E.barberia.agenda_abierta) return mal('La agenda está cerrada por ahora.');
    const viva = d.dispositivo && E.citas.find((c) => c.dispositivo === d.dispositivo && c.estado === 'agendada' && c.inicio > sumarMin(a, -30));
    if (viva) return mal('Ya tienes una cita activa.', 409, { codigo: viva.codigo });
    return crear(d);
  }
  if ((m = ruta.match(/^\/citas\/([A-Za-z0-9]{5})(\/\w+)?$/))) {
    const c = E.citas.find((x) => x.codigo === m![1].toUpperCase());
    if (!c) return mal('No encontramos esa cita.', 404);
    if (!m[2]) {
      const b = nombreBarbero(c.barbero_id);
      return ok({ ahora: a, barberia: E.barberia, cita: { codigo: c.codigo, inicio: c.inicio, estado: c.estado, nombre_publico: c.nombre_publico, servicios: c.servicios, total_l: c.total_l, recargo_l: c.recargo_l, recuperada: c.recuperada, barbero_id: c.barbero_id, barbero: b.nombre, barbero_apodo: b.apodo, con_whatsapp: c.telefono ? 1 : 0 } });
    }
    if (m[2] === '/cancelar') { if (c.estado !== 'agendada') return mal('Esta cita ya no se puede cancelar.'); c.estado = 'cancelada'; return ok({ ok: true }); }
    if (m[2] === '/mover') {
      if (c.estado !== 'agendada' || c.inicio <= a) return mal('Esta cita ya no se puede cambiar.');
      const h = disponibilidad(String(d.inicio).slice(0, 10)).find((x) => x.inicio === d.inicio);
      if (!h?.barberos.length) return mal('Esa hora ya se ocupó. Elige otra.');
      c.barbero_id = h.barberos.includes(c.barbero_id) ? c.barbero_id : h.barberos[0]; c.inicio = d.inicio;
      return ok({ ok: true });
    }
    if (m[2] === '/recuperar') {
      if (c.estado !== 'no_llego' || c.recuperada) return mal('Esta cita no se puede recuperar.');
      const r = crear({ nombre: c.nombre, servicios: c.servicios.map((s: any) => s.id), inicio: d.inicio, dispositivo: c.dispositivo }, false, { recargo_l: E.barberia.recargo_l, telefono: c.telefono });
      if (r.estado === 200) c.recuperada = 1;
      return r;
    }
  }

  // Acceso (en la demostración: PIN 111111 y cualquier correo con el código que aparece en pantalla)
  if (ruta === '/auth/pin' && d.pin === '111111' && E.barberos.find((b) => b.id === Number(d.barbero_id))?.es_admin) return ok({ token: `demo-dueno-${d.barbero_id}`, rol: 'dueno' });
  if (ruta === '/auth/pin') return d.pin === '111111' ? ok({ token: `demo-barbero-${d.barbero_id}`, rol: 'barbero' }) : mal('PIN incorrecto. En la demostración el PIN es 111111.', 401);
  if (ruta === '/auth/codigo') return ok({ ok: true, codigo_dev: '123456' });
  if (ruta === '/auth/verificar') return d.codigo === '123456' ? ok({ token: 'demo-dueno', rol: 'dueno' }) : mal('Código incorrecto o vencido.', 401);
  if (ruta.startsWith('/auth/passkey')) return mal('Face ID se activa cuando la app esté conectada a Cloudflare. En la demostración entra con el correo.', 400);
  if (ruta === '/auth/salir') return ok({ ok: true });
  if (!rol) return mal('Inicia sesión de nuevo.', 401);
  if (ruta === '/auth/yo') return ok({ rol, barbero_id: miBarbero ?? (Number(token!.split('-')[2]) || null), usuario_id: token === 'demo-dueno' ? 1 : null, passkeys: 1, cambiar_pin: false, atiende: true });

  if (ruta === '/agenda') {
    const fecha = p.get('fecha') ?? hoy, barbero = miBarbero ?? (Number(p.get('barbero')) || null);
    return ok({ fecha, ahora: a, barbero_id: barbero, barberia: E.barberia, barberos: E.barberos, servicios: E.servicios, horas: disponibilidad(fecha, true),
      citas: E.citas.filter((c) => c.inicio.startsWith(fecha) && c.estado !== 'cancelada' && (!barbero || c.barbero_id === barbero)).sort((x, y) => x.inicio.localeCompare(y.inicio)),
      bloqueos: E.bloqueos.filter((b) => b.inicio.startsWith(fecha)) });
  }
  if ((m = ruta.match(/^\/citas\/(\d+)\/accion$/))) {
    const c = E.citas.find((x) => x.id === Number(m![1]));
    if (!c) return mal('No existe la cita.', 404);
    const x = d.accion;
    if (x === 'llego' && c.estado === 'agendada') { c.estado = 'en_atencion'; c.llego_en = a; }
    else if (x === 'termine' && c.estado === 'en_atencion') { c.estado = 'terminada'; c.terminado_en = a; }
    else if (x === 'no_llego' && c.estado === 'agendada') { if (sumarMin(c.inicio, E.barberia.tolerancia_min) > a) return mal('Aún está en tolerancia.'); c.estado = 'no_llego'; }
    else if (x === 'cancelar' && c.estado === 'agendada') c.estado = 'cancelada';
    else if (x === 'deshacer' && ['en_atencion', 'no_llego'].includes(c.estado) && !c.recuperada) { c.estado = 'agendada'; c.llego_en = null; }
    else return mal('Esa acción no aplica a esta cita.');
    return ok({ ok: true });
  }
  if (ruta === '/agenda/manual') return crear({ ...d, barbero_id: miBarbero ?? d.barbero_id }, true);
  if (ruta === '/bloqueos') {
    const barbero = miBarbero ?? Number(d.barbero_id);
    E.bloqueos = E.bloqueos.filter((b) => !(b.barbero_id === barbero && b.inicio === d.inicio));
    if (!d.quitar) E.bloqueos.push({ barbero_id: barbero, inicio: d.inicio });
    return ok({ ok: true });
  }
  if (rol !== 'dueno') return mal('No tienes permiso para esto.', 403);
  if (ruta === '/config') return ok({ barberia: E.barberia, barberos: [...E.barberos].sort((a, b) => a.orden - b.orden), servicios: [...E.servicios].sort((a, b) => a.orden - b.orden), version: 2 });
  if (ruta === '/archivos') {
    const barbero = Number(p.get('barbero') ?? d.barbero) || null;
    const clave = metodo === 'DELETE' ? null : String(d.imagen ?? '');
    if (barbero) { const x = E.barberos.find((b) => b.id === barbero); if (!x) return mal('Esa persona ya no existe.', 404); x.foto_key = clave; }
    else E.barberia.logo_key = clave;
    return ok({ clave });
  }
  if (ruta === '/orden') {
    const lista = (d.tipo === 'barberos' ? E.barberos : E.servicios) as any[];
    (d.ids as number[]).forEach((id, i) => { const x = lista.find((y) => y.id === id); if (x) x.orden = i + 1; });
    return ok({ ok: true });
  }
  if ((m = ruta.match(/^\/(barberos|servicios)\/(\d+)$/)) && metodo === 'DELETE') {
    const id = Number(m[2]);
    if (m[1] === 'barberos') {
      const n = E.citas.filter((c) => c.barbero_id === id).length;
      if (n) return mal(`Tiene ${n} cita${n === 1 ? '' : 's'} en el historial. Desactívalo para que ya no aparezca ni pueda entrar.`);
      E.barberos = E.barberos.filter((b) => b.id !== id);
    } else {
      if (E.servicios.filter((x) => x.activo && x.id !== id).length === 0) return mal('Debe quedar al menos un servicio visible.');
      E.servicios = E.servicios.filter((x) => x.id !== id);
    }
    return ok({ ok: true });
  }
  if (ruta === '/usuarios' && metodo === 'GET') return ok({ usuarios: E.usuarios.map((u) => ({ ...u, yo: token === 'demo-dueno' && u.id === 1 })) });
  if (ruta === '/usuarios') {
    const email = String(d.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return mal('Escribe un correo válido.', 400);
    const ya = E.usuarios.find((u) => u.email === email);
    if (ya) ya.nombre = d.nombre || null; else E.usuarios.push({ id: E.sig++, email, nombre: d.nombre || null, creado_en: hoy, passkeys: 0, principal: false });
    return ok({ ok: true, invitado: false });
  }
  if ((m = ruta.match(/^\/usuarios\/(\d+)$/))) {
    const u = E.usuarios.find((x) => x.id === Number(m![1]));
    if (!u) return mal('Ese usuario ya no existe.', 404);
    if (u.principal) return mal('Este es el correo principal del dueño y no se puede quitar desde aquí.');
    E.usuarios = E.usuarios.filter((x) => x !== u);
    return ok({ ok: true });
  }
  if (ruta === '/barberia' && metodo === 'PUT') {
    if ('nombre' in d && String(d.nombre).trim().length < 2) return mal('Escribe el nombre del negocio.', 400);
    const red = (v: unknown) => (v ? String(v).trim().replace(/^@/, '') || null : null);
    E.barberia = { ...E.barberia, ...d, id: 1, whatsapp_numero: d.whatsapp_numero ? tel(String(d.whatsapp_numero).replace(/^504(?=\d{8}$)/, '')) : null, agenda_abierta: d.agenda_abierta ? 1 : 0,
      instagram: red(d.instagram ?? E.barberia.instagram), tiktok: red(d.tiktok ?? E.barberia.tiktok), facebook: red(d.facebook ?? E.barberia.facebook), mapa_url: d.mapa_url ?? E.barberia.mapa_url ?? null }; for (const k of ['duracion_cita_min', 'tolerancia_min', 'recargo_l', 'dias_anticipacion', 'anticipacion_min'] as const) (E.barberia as any)[k] = Number((E.barberia as any)[k]) || 0; return ok({ ok: true }); }
  if (ruta === '/barberos' || ruta === '/servicios') {
    const lista = (ruta === '/barberos' ? E.barberos : E.servicios) as any[];
    const { pin, pin_temporal, nuevo: _n, ...resto } = d;
    if (String(d.nombre ?? '').trim().length < 2) return mal('Escribe el nombre.', 400);
    const fila = { ...resto, activo: d.activo === false ? 0 : 1, ...(ruta === '/servicios' ? { precio_l: Number(d.precio_l) } : {
      con_pin: pin || d.con_pin ? 1 : 0, es_admin: d.es_admin ? 1 : 0, atiende: d.atiende === false ? 0 : 1, pin_digitos: 6,
      telefono: tel(d.telefono), ...(pin ? { debe_cambiar_pin: pin_temporal ? 1 : 0 } : {}) }) };
    const i = lista.findIndex((x) => x.id === d.id);
    if (i >= 0) { lista[i] = { ...lista[i], ...fila }; return ok({ ok: true, id: d.id }); }
    const id = E.sig++;
    lista.push({ ...fila, id, orden: lista.length + 1 });
    return ok({ ok: true, id });
  }
  if (ruta === '/metricas') {
    const rango = p.get('rango') ?? 'hoy', desde = rango === 'mes' ? sumarDias(hoy, -29) : rango === 'semana' ? sumarDias(hoy, -6) : hoy;
    const cs = E.citas.filter((c) => c.inicio >= desde), term = cs.filter((c) => c.estado === 'terminada');
    const retrasos = term.filter((c) => c.llego_en).map((c) => Math.max(0, Math.round((Date.parse(c.llego_en + ':00Z') - Date.parse(c.inicio + ':00Z')) / 60e3)));
    const porServicio: Record<string, any> = {}, porHora: Record<string, number> = {};
    for (const c of term) { porHora[c.inicio.slice(11, 13)] = (porHora[c.inicio.slice(11, 13)] ?? 0) + 1; for (const s of c.servicios) { const x = (porServicio[s.nombre] ??= { servicio: s.nombre, cantidad: 0, ingresos_l: 0 }); x.cantidad++; x.ingresos_l += s.precio_l; } }
    return ok({ rango, desde, hasta: hoy, atendidas: term.length, no_llego: cs.filter((c) => c.estado === 'no_llego').length, canceladas: cs.filter((c) => c.estado === 'cancelada').length,
      ingresos_l: term.reduce((t, c) => t + c.total_l, 0), recargos_l: term.reduce((t, c) => t + c.recargo_l, 0), pendientes: cs.filter((c) => c.estado === 'agendada').length,
      retraso_promedio_min: retrasos.length ? Math.round(retrasos.reduce((x, y) => x + y, 0) / retrasos.length) : 0, retraso_max_min: Math.max(0, ...retrasos),
      por_barbero: E.barberos.map((b) => ({ barbero: b.nombre, atendidas: term.filter((c) => c.barbero_id === b.id).length, no_llego: cs.filter((c) => c.barbero_id === b.id && c.estado === 'no_llego').length, ingresos_l: term.filter((c) => c.barbero_id === b.id).reduce((t, c) => t + c.total_l, 0) })),
      por_servicio: Object.values(porServicio), por_hora: Object.entries(porHora).sort().map(([hora, cantidad]) => ({ hora, cantidad })) });
  }
  if (ruta === '/clientes') return ok({ clientes: E.clientes });
  if (ruta === '/eventos/resumen') return ok({ total: { clics: 0, dispositivos: 0 }, por_quien: [], top: [], recientes: [] });
  if (ruta === '/whatsapp/estado') return ok({ modo: 'simulado', webhook_listo: false, plantilla_recordatorio: null, mensajes: E.mensajes.slice(0, 60) });
  if (ruta === '/whatsapp/prueba') { const t = tel(d.telefono); if (!t) return mal('Revisa el número (8 dígitos).', 400); wa('saliente', t, d.texto || 'Prueba de TurnoYa · Olimpo Barber Club ✂️', 'simulado'); return ok({ estado: 'simulado' }); }
  if (ruta === '/whatsapp/simular') {
    const t = tel(d.telefono); if (!t) return mal('Revisa el número (8 dígitos).', 400);
    wa('entrante', t, d.texto ?? '', 'recibido');
    const c = E.citas.find((x) => String(d.texto ?? '').toUpperCase().includes(x.codigo));
    if (!c) { wa('saliente', t, 'Hola 👋 Somos Olimpo Barber Club. Para recibir avisos de tu cita envíanos el código de 5 letras que te dio TurnoYa.', 'simulado'); return ok({ vinculada: false }); }
    c.telefono = t; wa('saliente', t, `¡Listo, ${c.nombre.split(' ')[0]}! Te avisaremos por aquí de tu cita en Olimpo Barber Club con ${nombreBarbero(c.barbero_id).nombre}.`, 'simulado');
    return ok({ vinculada: true, codigo: c.codigo });
  }
  return mal('No encontrado', 404);
}
