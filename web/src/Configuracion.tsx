// Configuración del negocio desde el teléfono del dueño o de un administrador:
// logo y nombre, datos del negocio, precios, horario, equipo y usuarios con correo.
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO, L, api, hora12 } from './api';
import { quitarImagen, subirImagen } from './imagen';
import { aMarca, refrescarMarca, urlArchivo } from './marca';
import { Aviso, Cargando, Carta, Confirmar, Interruptor, Logo, useDatos } from './ui';

type Seccion = 'marca' | 'negocio' | 'precios' | 'horario' | 'equipo' | 'usuarios';
type Mensaje = { tono: 'verde' | 'rojo'; texto: string } | null;
type Ctx = {
  datos: any; b: any; nueva: boolean; yo: any;
  /** Corre una acción, avisa el resultado y recarga la configuración. Devuelve lo que devolvió la acción, o null si falló. */
  correr: <T>(fn: () => Promise<T>, ok?: string | ((r: T) => string)) => Promise<T | null>;
  guardarBarberia: (cambios: object, ok?: string) => Promise<unknown>;
  avisar: (m: Mensaje) => void;
  volver: () => void;
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes

export default function Configuracion({ yo }: { yo: any }) {
  const { datos, recargar, error } = useDatos<any>('/config');
  const [sec, setSec] = useState<Seccion | null>(null);
  const [msj, setMsj] = useState<Mensaje>(null);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [sec]);
  useEffect(() => {
    if (msj?.tono !== 'verde') return;
    const t = setTimeout(() => setMsj(null), 3500);
    return () => clearTimeout(t);
  }, [msj]);
  if (error && !datos) return <Aviso>{error.message}</Aviso>;
  if (!datos) return <Cargando />;

  const b = datos.barberia;
  // Una API publicada antes de esta pantalla no guarda logo con texto, redes, usuarios ni orden
  const nueva = DEMO || (datos.version ?? 1) >= 2;
  const correr: Ctx['correr'] = async (fn, ok = 'Guardado.') => {
    try {
      const r = await fn();
      setMsj({ tono: 'verde', texto: typeof ok === 'function' ? ok(r) : ok });
      await recargar();
      return r;
    } catch (e: any) {
      setMsj({ tono: 'rojo', texto: e?.message ?? 'No se pudo guardar.' });
      return null;
    }
  };
  // Se envía la barbería completa con los cambios: funciona igual con la API nueva y con la anterior
  const guardarBarberia = (cambios: object, ok?: string) =>
    correr(async () => { await api('/barberia', { ...b, ...cambios }, 'PUT'); await refrescarMarca(); }, ok);
  const ctx: Ctx = { datos, b, nueva, yo, correr, guardarBarberia, avisar: setMsj, volver: () => setSec(null) };

  const abiertos = ORDEN_DIAS.filter((i) => b.horario[i]);
  const servicios = datos.servicios.filter((s: any) => s.activo);
  return (
    <div>
      {msj && (
        <div className="fixed inset-x-0 top-3 z-50 mx-auto max-w-md px-4" role="status" onClick={() => setMsj(null)}>
          <div className={`rounded-xl border px-4 py-3 font-semibold shadow-xl ${msj.tono === 'verde' ? 'border-verde bg-[#0f2a20]' : 'border-rojo bg-[#2d1214]'}`}>{msj.texto}</div>
        </div>
      )}
      {!nueva && (
        <div className="mb-4"><Aviso tono="azul">
          <b>Falta publicar la API nueva.</b> Mientras tanto se guardan precios, servicios, horario, equipo, nombre, dirección y logo.
          Los textos del logo, las redes, el orden y los usuarios con correo se activan al publicarla.
        </Aviso></div>
      )}
      {sec === null && (
        <>
          <h2 className="titulo text-4xl">Configuración</h2>
          <p className="mt-1 text-tenue">Todo lo que ven tus clientes y quién entra a la app.</p>
          <Carta className="mt-4">
            <Interruptor activo={!!b.agenda_abierta} etiqueta={<b>Aceptar citas nuevas</b>}
              detalle={b.agenda_abierta ? 'Los clientes pueden agendar.' : 'Agenda cerrada: nadie puede agendar.'}
              onCambio={(v) => guardarBarberia({ agenda_abierta: v ? 1 : 0 }, v ? 'Agenda abierta.' : 'Agenda cerrada: no se aceptan citas nuevas.')} />
          </Carta>
          <ul className="mt-4 divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-carta">
            <Fila icono="imagen" titulo="Logo y nombre" resumen={b.nombre} onClick={() => setSec('marca')} />
            <Fila icono="tienda" titulo="Datos del negocio" resumen={[b.direccion, b.whatsapp_numero && 'WhatsApp', b.instagram && 'Instagram', b.facebook && 'Facebook', b.tiktok && 'TikTok'].filter(Boolean).join(' · ') || 'Dirección, WhatsApp y redes'} onClick={() => setSec('negocio')} />
            <Fila icono="precio" titulo="Precios y servicios" resumen={servicios.map((s: any) => `${s.nombre} ${L(s.precio_l)}`).join(' · ') || 'Sin servicios visibles'} onClick={() => setSec('precios')} />
            <Fila icono="reloj" titulo="Horario y reglas de citas" resumen={`${abiertos.length} día${abiertos.length === 1 ? '' : 's'} a la semana · citas de ${b.duracion_cita_min} min`} onClick={() => setSec('horario')} />
            <Fila icono="equipo" titulo="Equipo" resumen={`${datos.barberos.filter((x: any) => x.activo).length} activos · barberos y administradores`} onClick={() => setSec('equipo')} />
            <Fila icono="correo" titulo="Usuarios con correo" resumen={nueva ? 'Quién entra al panel con su correo' : 'Se activa al publicar la API nueva'} onClick={() => setSec('usuarios')} deshabilitada={!nueva} />
          </ul>
          <p className="mt-4 text-center text-sm text-tenue"><Link className="underline" to="/">Ver la página de inicio como cliente</Link></p>
        </>
      )}
      {sec === 'marca' && <SecMarca ctx={ctx} />}
      {sec === 'negocio' && <SecNegocio ctx={ctx} />}
      {sec === 'precios' && <SecPrecios ctx={ctx} />}
      {sec === 'horario' && <SecHorario ctx={ctx} />}
      {sec === 'equipo' && <SecEquipo ctx={ctx} />}
      {sec === 'usuarios' && <SecUsuarios ctx={ctx} />}
    </div>
  );
}

// ---------- Piezas ----------
const ICONOS: Record<string, ReactNode> = {
  imagen: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M3 17l5-5 4 4 3-3 6 6" /></>,
  tienda: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9h16v11H4z" /><path d="M10 20v-5h4v5" /></>,
  precio: <><path d="M3 12V3h9l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  equipo: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17.5" cy="9" r="2.5" /><path d="M16 14.6c2.8.2 5 2 5 4.9" /></>,
  correo: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
};
const Icono = ({ nombre, className = 'h-6 w-6' }: { nombre: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[nombre]}</svg>
);
const Flecha = ({ izquierda = false }: { izquierda?: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d={izquierda ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
);

function Fila({ icono, titulo, resumen, onClick, deshabilitada }: { icono: string; titulo: string; resumen: string; onClick: () => void; deshabilitada?: boolean }) {
  return (
    <li>
      <button className={`flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-borde/40 ${deshabilitada ? 'opacity-50' : ''}`} onClick={onClick} disabled={deshabilitada}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-azul/20 text-azul"><Icono nombre={icono} /></span>
        <span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{titulo}</span><span className="block truncate text-sm text-tenue">{resumen}</span></span>
        <span className="text-tenue"><Flecha /></span>
      </button>
    </li>
  );
}

/** Subpantalla con botón para volver y, si hay, una barra fija abajo con el botón de guardar. */
function Sub({ titulo, volver, atras = 'Configuración', children, pie }: { titulo: string; volver: () => void; atras?: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div>
      <button className="-ml-1 flex min-h-11 items-center gap-1 pr-3 text-lg text-tenue" onClick={volver}><Flecha izquierda />{atras}</button>
      <h2 className="titulo mt-1 text-4xl">{titulo}</h2>
      <div className="mt-4 grid gap-4">{children}</div>
      {pie && <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-borde bg-fondo/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">{pie}</div>}
    </div>
  );
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: ReactNode; ayuda?: ReactNode; children: ReactNode }) {
  // La ayuda va fuera de la etiqueta para que el nombre del campo sea corto al leerlo en voz alta
  return (
    <div className="text-sm text-tenue">
      <label className="block">
        {etiqueta}
        <div className="mt-1 text-base text-crema">{children}</div>
      </label>
      {ayuda && <p className="mt-1 text-xs leading-snug">{ayuda}</p>}
    </div>
  );
}

const Insignia = ({ children, tono = 'tenue' }: { children: ReactNode; tono?: 'tenue' | 'azul' | 'rojo' | 'verde' }) => {
  const c = { tenue: 'border-borde text-tenue', azul: 'border-azul/60 text-azul', rojo: 'border-rojo/60 text-rojo', verde: 'border-verde/60 text-verde' }[tono];
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
};

const soloDigitos = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
const igual = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** Botón para elegir una imagen de la galería o tomar una foto. */
function ElegirImagen({ texto, onArchivo, ocupado, clase = 'btn btn-azul' }: { texto: string; onArchivo: (f: File) => void; ocupado: boolean; clase?: string }) {
  return (
    <label className={`${clase} cursor-pointer ${ocupado ? 'pointer-events-none opacity-50' : ''}`}>
      {ocupado ? 'Subiendo…' : texto}
      <input type="file" accept="image/*" className="sr-only" disabled={ocupado}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onArchivo(f); }} />
    </label>
  );
}

// ---------- Logo y nombre ----------
function SecMarca({ ctx }: { ctx: Ctx }) {
  const { b, nueva } = ctx;
  const inicial = {
    nombre: b.nombre ?? '',
    marca_titulo: b.marca_titulo ?? 'OLIMPO',
    marca_subtitulo: b.marca_subtitulo ?? 'BARBER CLUB',
    logo_con_texto: b.logo_con_texto ?? 1,
  };
  const [f, setF] = useState(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [quitar, setQuitar] = useState(false);
  const vista = aMarca({ ...b, ...f });
  const cambiado = !igual(f, inicial);

  async function subir(archivo: File) {
    setSubiendo(true);
    await ctx.correr(async () => { await subirImagen(archivo); await refrescarMarca(); }, 'Logo actualizado en toda la app.');
    setSubiendo(false);
  }
  return (
    <Sub titulo="Logo y nombre" volver={ctx.volver}
      pie={<button className="btn btn-rojo" disabled={!cambiado || f.nombre.trim().length < 2} onClick={() => ctx.guardarBarberia(f, 'Nombre y logo guardados.')}>Guardar</button>}>
      <Carta>
        <div className="text-sm text-tenue">Así se ve</div>
        <div className="mt-3 rounded-xl border border-borde bg-fondo px-4 py-6"><Logo grande marca={vista} /></div>
        <div className="mt-2 rounded-xl border border-borde bg-fondo p-3"><Logo marca={vista} /></div>
      </Carta>
      <Carta>
        <h3 className="titulo text-2xl">Imagen del logo</h3>
        <p className="mt-1 text-sm text-tenue">Elige el logo desde tu galería. Queda mejor en PNG con fondo transparente. El tamaño se ajusta solo.</p>
        <div className="mt-3 grid gap-2">
          <ElegirImagen texto={b.logo_key ? 'Cambiar logo' : 'Subir logo'} ocupado={subiendo} onArchivo={subir} />
          {b.logo_key && <button className="btn btn-linea !text-lg" onClick={() => setQuitar(true)}>Quitar y usar el emblema original</button>}
        </div>
        {b.logo_key && (
          <div className="mt-3 border-t border-borde pt-3">
            <Interruptor activo={!!f.logo_con_texto} onCambio={(v) => setF({ ...f, logo_con_texto: v ? 1 : 0 })} deshabilitado={!nueva}
              etiqueta="Mostrar el nombre junto al logo" detalle="Apágalo si tu imagen ya trae el nombre escrito." />
          </div>
        )}
      </Carta>
      <Carta>
        <div className="grid gap-4">
          <Campo etiqueta="Nombre del negocio" ayuda="Se usa en los mensajes de WhatsApp, en los correos y en la pestaña del navegador.">
            <input className="campo" maxLength={40} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Olimpo Barber Club" />
          </Campo>
          <Campo etiqueta="Texto grande del logo" ayuda={nueva ? 'Si lo dejas vacío se usa el nombre del negocio.' : 'Se activa al publicar la API nueva.'}>
            <input className="campo" maxLength={24} value={f.marca_titulo} disabled={!nueva} onChange={(e) => setF({ ...f, marca_titulo: e.target.value })} placeholder={f.nombre} />
          </Campo>
          <Campo etiqueta="Texto pequeño debajo (opcional)">
            <input className="campo" maxLength={32} value={f.marca_subtitulo} disabled={!nueva || !f.marca_titulo.trim()} onChange={(e) => setF({ ...f, marca_subtitulo: e.target.value })} placeholder="BARBER CLUB" />
          </Campo>
        </div>
      </Carta>
      {quitar && <Confirmar titulo="¿Quitar el logo?" texto="Vuelve a mostrarse el emblema original de Olimpo." si="Sí, quitar"
        onNo={() => setQuitar(false)} onSi={async () => { setQuitar(false); await ctx.correr(async () => { await quitarImagen(); await refrescarMarca(); }, 'Logo quitado.'); }} />}
    </Sub>
  );
}

// ---------- Datos del negocio ----------
function SecNegocio({ ctx }: { ctx: Ctx }) {
  const { b, nueva } = ctx;
  const inicial = {
    descripcion: b.descripcion ?? '', direccion: b.direccion ?? '', mapa_url: b.mapa_url ?? '',
    whatsapp_numero: String(b.whatsapp_numero ?? '').replace(/^504/, ''),
    instagram: b.instagram ?? '', facebook: b.facebook ?? '', tiktok: b.tiktok ?? '',
  };
  const [f, setF] = useState(inicial);
  const telOk = !f.whatsapp_numero || soloDigitos(f.whatsapp_numero, 20).length === 8 || soloDigitos(f.whatsapp_numero, 20).length >= 11;
  const campo = (k: keyof typeof f, props: object = {}) => (
    <input className="campo" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
  );
  const soloNueva = nueva ? undefined : 'Se activa al publicar la API nueva.';
  return (
    <Sub titulo="Datos del negocio" volver={ctx.volver}
      pie={<button className="btn btn-rojo" disabled={igual(f, inicial) || !telOk} onClick={() => ctx.guardarBarberia(f, 'Datos del negocio guardados.')}>Guardar</button>}>
      <Carta>
        <div className="grid gap-4">
          <Campo etiqueta="Bienvenida (opcional)" ayuda={soloNueva ?? 'Una o dos frases que aparecen en la página de inicio.'}>
            <textarea className="campo min-h-24" maxLength={300} value={f.descripcion} disabled={!nueva} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Cortes clásicos y modernos en Quimistán." />
          </Campo>
          <Campo etiqueta="Dirección">{campo('direccion', { maxLength: 160, placeholder: 'Barrio, calle, referencia' })}</Campo>
          <Campo etiqueta="Enlace de Google Maps (opcional)" ayuda={soloNueva ?? 'En Google Maps busca tu negocio, toca Compartir y luego Copiar enlace.'}>
            {campo('mapa_url', { inputMode: 'url', placeholder: 'https://maps.app.goo.gl/…', disabled: !nueva })}
          </Campo>
        </div>
      </Carta>
      <Carta>
        <div className="grid gap-4">
          <Campo etiqueta="WhatsApp de la barbería" ayuda="Aquí llegan los mensajes de los clientes cuando confirman su cita.">
            <div className="flex gap-2">
              <span className="campo !w-auto text-tenue">+504</span>
              <input className="campo" inputMode="numeric" maxLength={12} value={f.whatsapp_numero} aria-invalid={!telOk}
                onChange={(e) => setF({ ...f, whatsapp_numero: e.target.value.replace(/[^\d-]/g, '') })} placeholder="9999-9999" />
            </div>
          </Campo>
          {!telOk && <p className="-mt-2 text-sm text-rojo">El número debe tener 8 dígitos.</p>}
          <Campo etiqueta="Instagram" ayuda={soloNueva}>{campo('instagram', { placeholder: '@olimpobarberclub', autoCapitalize: 'none', disabled: !nueva })}</Campo>
          <Campo etiqueta="Facebook" ayuda={soloNueva ?? 'El nombre de la página o el enlace completo.'}>{campo('facebook', { placeholder: 'olimpobarberclub', autoCapitalize: 'none', disabled: !nueva })}</Campo>
          <Campo etiqueta="TikTok" ayuda={soloNueva}>{campo('tiktok', { placeholder: '@olimpobarberclub', autoCapitalize: 'none', disabled: !nueva })}</Campo>
        </div>
      </Carta>
    </Sub>
  );
}

// ---------- Precios y servicios ----------
function SecPrecios({ ctx }: { ctx: Ctx }) {
  const { datos, b, nueva } = ctx;
  const servicios: any[] = datos.servicios;
  const [agregar, setAgregar] = useState(false);
  const [recargo, setRecargo] = useState(String(b.recargo_l ?? 0));
  const mover = (i: number, d: number) => {
    const ids = servicios.map((s) => s.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    return ctx.correr(() => api('/orden', { tipo: 'servicios', ids }), 'Orden guardado.');
  };
  return (
    <Sub titulo="Precios y servicios" volver={ctx.volver}>
      <p className="text-tenue">Cambia el precio y toca <b className="text-crema">Guardar</b>. Los clientes lo ven al instante; las citas ya agendadas conservan el precio con que se reservaron.</p>
      {servicios.map((s, i) => (
        <TarjetaServicio key={s.id} s={s} ctx={ctx}
          onSubir={nueva && i > 0 ? () => mover(i, -1) : undefined}
          onBajar={nueva && i < servicios.length - 1 ? () => mover(i, 1) : undefined} />
      ))}
      {agregar
        ? <TarjetaServicio s={{ nombre: '', descripcion: '', precio_l: '', activo: 1 }} ctx={ctx} onListo={() => setAgregar(false)} />
        : <button className="btn btn-azul" onClick={() => setAgregar(true)}>+ Agregar servicio</button>}
      <Carta>
        <h3 className="titulo text-2xl">Recargo por recuperar</h3>
        <p className="mt-1 text-sm text-tenue">Lo paga quien perdió su hora por no llegar y quiere tomar otra.</p>
        <div className="mt-3 flex items-center gap-2">
          <PrecioCampo valor={recargo} onCambio={setRecargo} etiqueta="Recargo en lempiras" />
          <button className="btn btn-linea !w-auto !text-lg" disabled={recargo === '' || Number(recargo) === b.recargo_l}
            onClick={() => ctx.guardarBarberia({ recargo_l: Number(recargo) }, 'Recargo guardado.')}>Guardar</button>
        </div>
      </Carta>
    </Sub>
  );
}

function PrecioCampo({ valor, onCambio, etiqueta }: { valor: string; onCambio: (v: string) => void; etiqueta: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-[.9rem] border-2 border-borde bg-fondo focus-within:border-azul">
      <span className="titulo pl-4 text-2xl text-tenue">L</span>
      <input aria-label={etiqueta} className="titulo w-full min-w-0 bg-transparent px-2 py-2 text-right text-4xl outline-none" inputMode="numeric" enterKeyHint="done"
        value={valor} onChange={(e) => onCambio(soloDigitos(e.target.value, 6))} onFocus={(e) => e.target.select()} placeholder="0" />
    </div>
  );
}

function TarjetaServicio({ s, ctx, onSubir, onBajar, onListo }: { s: any; ctx: Ctx; onSubir?: () => void; onBajar?: () => void; onListo?: () => void }) {
  const inicial = { nombre: s.nombre, descripcion: s.descripcion ?? '', precio_l: String(s.precio_l ?? ''), activo: s.activo ? 1 : 0 };
  const [x, setX] = useState(inicial);
  const [borrar, setBorrar] = useState(false);
  const nuevo = !s.id;
  const valido = x.nombre.trim().length >= 2 && x.precio_l !== '';
  async function guardar() {
    const r = await ctx.correr(() => api('/servicios', { ...s, ...x, precio_l: Number(x.precio_l), activo: !!x.activo }),
      nuevo ? `${x.nombre.trim()} agregado.` : `${x.nombre.trim()}: guardado.`);
    if (r && nuevo) onListo?.();
  }
  return (
    <section className={`rounded-2xl border bg-carta p-4 ${nuevo ? 'border-azul' : 'border-borde'} ${x.activo ? '' : 'opacity-70'}`}>
      {nuevo && <h3 className="titulo mb-3 text-2xl">Nuevo servicio</h3>}
      <div className="flex items-center gap-2">
        <input aria-label="Nombre del servicio" className="campo titulo min-w-0 flex-[1.3] !text-2xl" maxLength={40} value={x.nombre} placeholder="Nombre"
          onChange={(e) => setX({ ...x, nombre: e.target.value })} />
        <PrecioCampo valor={x.precio_l} onCambio={(v) => setX({ ...x, precio_l: v })} etiqueta={`Precio de ${x.nombre || 'el servicio'} en lempiras`} />
      </div>
      <input aria-label="Descripción" className="campo mt-2 !text-base" maxLength={120} value={x.descripcion} placeholder="Descripción corta (opcional)"
        onChange={(e) => setX({ ...x, descripcion: e.target.value })} />
      {!nuevo && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1"><Interruptor activo={!!x.activo} onCambio={(v) => setX({ ...x, activo: v ? 1 : 0 })} etiqueta="Visible" /></div>
          {onSubir && <button className="h-11 w-11 rounded-xl border-2 border-borde text-xl" aria-label={`Subir ${s.nombre}`} onClick={onSubir}>↑</button>}
          {onBajar && <button className="h-11 w-11 rounded-xl border-2 border-borde text-xl" aria-label={`Bajar ${s.nombre}`} onClick={onBajar}>↓</button>}
        </div>
      )}
      {(nuevo || !igual(x, inicial)) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn btn-linea !min-h-12 !text-lg" onClick={() => (nuevo ? onListo?.() : setX(inicial))}>{nuevo ? 'Cancelar' : 'Deshacer'}</button>
          <button className="btn btn-rojo !min-h-12 !text-lg" disabled={!valido} onClick={guardar}>{nuevo ? 'Agregar' : 'Guardar'}</button>
        </div>
      )}
      {!nuevo && ctx.nueva && igual(x, inicial) && (
        <button className="mt-2 text-sm text-tenue underline" onClick={() => setBorrar(true)}>Eliminar servicio</button>
      )}
      {borrar && <Confirmar titulo={`¿Eliminar ${s.nombre}?`} texto="Ya no se podrá elegir al agendar. Las citas anteriores no cambian. Si solo quieres esconderlo un tiempo, apaga «Visible»." si="Sí, eliminar"
        onNo={() => setBorrar(false)} onSi={() => { setBorrar(false); ctx.correr(() => api(`/servicios/${s.id}`, undefined, 'DELETE'), `${s.nombre} eliminado.`); }} />}
    </section>
  );
}

// ---------- Horario y reglas ----------
function SecHorario({ ctx }: { ctx: Ctx }) {
  const { b } = ctx;
  const inicial = {
    horario: b.horario as Record<string, [string, string] | null>, almuerzo: b.almuerzo as [string, string] | null,
    duracion_cita_min: String(b.duracion_cita_min), tolerancia_min: String(b.tolerancia_min),
    anticipacion_min: String(b.anticipacion_min ?? 0), dias_anticipacion: String(b.dias_anticipacion),
  };
  const [f, setF] = useState(inicial);
  const ponerDia = (i: number, r: [string, string] | null) => setF({ ...f, horario: { ...f.horario, [i]: r } });
  const malos = ORDEN_DIAS.filter((i) => f.horario[i] && f.horario[i]![0] >= f.horario[i]![1]);
  const almuerzoMalo = !!f.almuerzo && f.almuerzo[0] >= f.almuerzo[1];
  const primero = ORDEN_DIAS.map((i) => f.horario[i]).find(Boolean) ?? null;
  const numero = (k: 'duracion_cita_min' | 'tolerancia_min' | 'anticipacion_min' | 'dias_anticipacion', etiqueta: string, sufijo: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      <div className="flex items-center gap-2">
        <input className="campo" inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: soloDigitos(e.target.value, 4) })} />
        <span className="shrink-0 text-tenue">{sufijo}</span>
      </div>
    </Campo>
  );
  const valido = !malos.length && !almuerzoMalo && Object.values(f).every((v) => v !== '');
  return (
    <Sub titulo="Horario y reglas" volver={ctx.volver}
      pie={<button className="btn btn-rojo" disabled={igual(f, inicial) || !valido}
        onClick={() => ctx.guardarBarberia({ ...f, duracion_cita_min: Number(f.duracion_cita_min), tolerancia_min: Number(f.tolerancia_min), anticipacion_min: Number(f.anticipacion_min), dias_anticipacion: Number(f.dias_anticipacion) }, 'Horario guardado.')}>Guardar</button>}>
      <Carta>
        <h3 className="titulo text-2xl">Días y horas</h3>
        <div className="mt-2 divide-y divide-borde">
          {ORDEN_DIAS.map((i) => {
            const r = f.horario[i];
            return (
              <div key={i} className="py-2">
                <Interruptor activo={!!r} etiqueta={DIAS[i]} detalle={r ? `${hora12(r[0])} a ${hora12(r[1])}` : 'Cerrado'}
                  onCambio={(v) => ponerDia(i, v ? primero ?? ['10:00', '21:00'] : null)} />
                {r && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pb-1">
                    <label className="text-sm text-tenue">Abre<input aria-label={`${DIAS[i]} abre`} type="time" className="campo mt-1 !px-2" value={r[0]} onChange={(e) => ponerDia(i, [e.target.value, r[1]])} /></label>
                    <label className="text-sm text-tenue">Cierra<input aria-label={`${DIAS[i]} cierra`} type="time" className="campo mt-1 !px-2" value={r[1]} onChange={(e) => ponerDia(i, [r[0], e.target.value])} /></label>
                  </div>
                )}
                {malos.includes(i) && <p className="text-sm text-rojo">La hora de cierre debe ser después de la de apertura.</p>}
              </div>
            );
          })}
        </div>
        {primero && (
          <button className="btn btn-linea mt-2 !min-h-12 !text-lg" onClick={() => setF({ ...f, horario: Object.fromEntries(Object.entries(f.horario).map(([k, v]) => [k, v ? [...primero] as [string, string] : null])) })}>
            Usar {hora12(primero[0])} a {hora12(primero[1])} en todos los días abiertos
          </button>
        )}
      </Carta>
      <Carta>
        <Interruptor activo={!!f.almuerzo} etiqueta="Hora de almuerzo" detalle="En ese rato no se puede agendar."
          onCambio={(v) => setF({ ...f, almuerzo: v ? ['12:00', '13:00'] : null })} />
        {f.almuerzo && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-sm text-tenue">Desde<input aria-label="Almuerzo desde" type="time" className="campo mt-1 !px-2" value={f.almuerzo[0]} onChange={(e) => setF({ ...f, almuerzo: [e.target.value, f.almuerzo![1]] })} /></label>
            <label className="text-sm text-tenue">Hasta<input aria-label="Almuerzo hasta" type="time" className="campo mt-1 !px-2" value={f.almuerzo[1]} onChange={(e) => setF({ ...f, almuerzo: [f.almuerzo![0], e.target.value] })} /></label>
          </div>
        )}
        {almuerzoMalo && <p className="mt-1 text-sm text-rojo">El almuerzo debe terminar después de empezar.</p>}
      </Carta>
      <Carta>
        <h3 className="titulo text-2xl">Reglas de las citas</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {numero('duracion_cita_min', 'Cada cita dura', 'min')}
          {numero('tolerancia_min', 'Tolerancia de espera', 'min', 'Después, el barbero puede marcar «No llegó».')}
          {numero('anticipacion_min', 'Reservar al menos', 'min antes')}
          {numero('dias_anticipacion', 'Agendar hasta con', 'días')}
        </div>
      </Carta>
    </Sub>
  );
}

// ---------- Equipo ----------
function Avatar({ x, tam = 'h-12 w-12' }: { x: any; tam?: string }) {
  const url = urlArchivo(x.foto_key);
  return url
    ? <img src={url} alt="" className={`${tam} shrink-0 rounded-full object-cover`} />
    : <span className={`${tam} titulo flex shrink-0 items-center justify-center rounded-full bg-borde text-2xl`} aria-hidden="true">{(x.nombre || '?').charAt(0).toUpperCase()}</span>;
}

function SecEquipo({ ctx }: { ctx: Ctx }) {
  const { datos, nueva, yo } = ctx;
  const [editando, setEditando] = useState<any>(null);
  const lista: any[] = datos.barberos;
  if (editando) {
    // Si se acaba de crear o se recargó, se toma la versión al día
    const actual = editando.id ? lista.find((x) => x.id === editando.id) ?? editando : editando;
    return <EditarPersona key={actual.id ?? 'nuevo'} x={actual} ctx={ctx} esYo={!!yo.barbero_id && actual.id === yo.barbero_id}
      onVolver={() => setEditando(null)} onCreado={(id) => setEditando({ id })} />;
  }
  const mover = (i: number, d: number) => {
    const ids = lista.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    ctx.correr(() => api('/orden', { tipo: 'barberos', ids }), 'Orden guardado.');
  };
  return (
    <Sub titulo="Equipo" volver={ctx.volver}>
      <p className="text-tenue"><b className="text-crema">Barbero:</b> entra con su PIN y ve su agenda. <b className="text-crema">Administrador:</b> además entra a este panel y puede cambiar todo.</p>
      <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-carta">
        {lista.map((x, i) => (
          <li key={x.id} className="flex items-center">
            <button className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-borde/40" onClick={() => setEditando(x)}>
              <Avatar x={x} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{x.nombre}{x.apodo ? <span className="font-normal text-tenue"> “{x.apodo}”</span> : null}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {yo.barbero_id === x.id && <Insignia tono="verde">Tú</Insignia>}
                  {x.es_admin ? <Insignia tono="azul">Administrador</Insignia> : null}
                  {x.atiende === 0 ? <Insignia>No atiende clientes</Insignia> : <Insignia>Barbero</Insignia>}
                  {!x.activo && <Insignia tono="rojo">Inactivo</Insignia>}
                  {!x.con_pin && <Insignia tono="rojo">Sin PIN</Insignia>}
                  {x.debe_cambiar_pin ? <Insignia>PIN temporal</Insignia> : null}
                </span>
              </span>
              <span className="text-tenue"><Flecha /></span>
            </button>
            {nueva && lista.length > 1 && (
              <span className="flex flex-col gap-1 pr-2">
                <button className="h-9 w-9 rounded-lg border border-borde disabled:opacity-20" disabled={i === 0} aria-label={`Subir a ${x.nombre}`} onClick={() => mover(i, -1)}>↑</button>
                <button className="h-9 w-9 rounded-lg border border-borde disabled:opacity-20" disabled={i === lista.length - 1} aria-label={`Bajar a ${x.nombre}`} onClick={() => mover(i, 1)}>↓</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <button className="btn btn-azul" onClick={() => setEditando({ nombre: '', apodo: '', activo: 1, atiende: 1, es_admin: 0 })}>+ Agregar persona</button>
      <p className="text-sm text-tenue">El orden de la lista es el orden en que los clientes ven a los barberos al agendar.</p>
    </Sub>
  );
}

function EditarPersona({ x, ctx, esYo, onVolver, onCreado }: { x: any; ctx: Ctx; esYo: boolean; onVolver: () => void; onCreado: (id: number) => void }) {
  const nuevo = !x.id;
  const inicial = {
    nombre: x.nombre ?? '', apodo: x.apodo ?? '', telefono: String(x.telefono ?? '').replace(/^504/, ''),
    atiende: x.atiende !== 0, es_admin: !!x.es_admin, activo: x.activo !== 0,
  };
  const [f, setF] = useState(inicial);
  const [pin, setPin] = useState('');
  const [temporal, setTemporal] = useState(!esYo);
  const [subiendo, setSubiendo] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const telOk = !f.telefono || soloDigitos(f.telefono, 20).length === 8;
  const pinOk = !pin || pin.length === 6;
  const necesitaPin = f.es_admin && !x.con_pin && !pin;
  const cambiado = !igual(f, inicial) || !!pin;
  const valido = f.nombre.trim().length >= 2 && telOk && pinOk && !necesitaPin;

  async function guardar() {
    const r = await ctx.correr(
      () => api<any>('/barberos', { ...x, ...f, telefono: f.telefono || null, pin: pin || undefined, pin_temporal: temporal }),
      nuevo ? `${f.nombre.trim()} agregado.${pin ? '' : ' Ponle un PIN para que pueda entrar.'}` : 'Guardado.');
    if (!r) return;
    setPin('');
    // Recién creado: se queda abierto para subir su foto (la API anterior no devuelve el id: vuelve a la lista)
    if (nuevo && r.id) onCreado(r.id); else onVolver();
  }
  async function foto(archivo: File) {
    setSubiendo(true);
    await ctx.correr(() => subirImagen(archivo, x.id), 'Foto actualizada.');
    setSubiendo(false);
  }
  return (
    <Sub titulo={nuevo ? 'Nueva persona' : x.nombre} volver={onVolver} atras="Equipo"
      pie={<button className="btn btn-rojo" disabled={!cambiado || !valido} onClick={guardar}>{nuevo ? 'Agregar' : 'Guardar'}</button>}>
      {!nuevo && (
        <Carta>
          <div className="flex items-center gap-4">
            <Avatar x={x} tam="h-20 w-20" />
            <div className="grid flex-1 gap-2">
              <ElegirImagen texto={x.foto_key ? 'Cambiar foto' : 'Subir foto'} ocupado={subiendo} onArchivo={foto} clase="btn btn-linea !min-h-12 !text-lg" />
              {x.foto_key && ctx.nueva && <button className="text-sm text-tenue underline" onClick={() => ctx.correr(() => quitarImagen(x.id), 'Foto quitada.')}>Quitar foto</button>}
            </div>
          </div>
        </Carta>
      )}
      <Carta>
        <div className="grid gap-4">
          <Campo etiqueta="Nombre"><input className="campo" maxLength={40} autoComplete="off" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre y apellido" /></Campo>
          <Campo etiqueta="Apodo (opcional)" ayuda="Cómo lo conocen los clientes.">
            <input className="campo" maxLength={40} autoComplete="off" value={f.apodo} onChange={(e) => setF({ ...f, apodo: e.target.value })} />
          </Campo>
          <Campo etiqueta="WhatsApp para avisos de citas (opcional)">
            <div className="flex gap-2">
              <span className="campo !w-auto text-tenue">+504</span>
              <input className="campo" inputMode="numeric" maxLength={9} value={f.telefono} aria-invalid={!telOk} onChange={(e) => setF({ ...f, telefono: e.target.value.replace(/[^\d-]/g, '') })} placeholder="9999-9999" />
            </div>
          </Campo>
          {!telOk && <p className="-mt-2 text-sm text-rojo">El número debe tener 8 dígitos.</p>}
        </div>
      </Carta>
      <Carta>
        <h3 className="titulo text-2xl">PIN de entrada</h3>
        <p className="mt-1 text-sm text-tenue">{x.con_pin ? 'Ya tiene PIN. Escribe uno nuevo solo si quieres cambiarlo.' : 'Sin PIN no puede entrar a la app.'}</p>
        <input aria-label="PIN nuevo de 6 números" className="campo titulo mt-3 text-center !text-3xl tracking-[.4em]" inputMode="numeric" autoComplete="off" maxLength={6}
          value={pin} onChange={(e) => setPin(soloDigitos(e.target.value, 6))} placeholder="••••••" />
        {!pinOk && <p className="mt-1 text-sm text-rojo">El PIN debe tener 6 números.</p>}
        {!esYo && pin && (
          <div className="mt-3"><Interruptor activo={temporal} onCambio={setTemporal} etiqueta="PIN temporal" detalle="Al entrar tendrá que crear su propio PIN." /></div>
        )}
      </Carta>
      <Carta>
        <div className="grid gap-2">
          <Interruptor activo={f.atiende} onCambio={(v) => setF({ ...f, atiende: v })} etiqueta="Atiende clientes" detalle="Aparece para agendar citas." />
          <Interruptor activo={f.es_admin} onCambio={(v) => setF({ ...f, es_admin: v })} deshabilitado={esYo} etiqueta="Administrador"
            detalle={esYo ? 'No puedes quitarte tu propio acceso.' : 'Entra a este panel con su PIN: precios, logo, equipo y todo lo demás.'} />
          {!nuevo && <Interruptor activo={f.activo} onCambio={(v) => setF({ ...f, activo: v })} deshabilitado={esYo} etiqueta="Activo" detalle="Si lo apagas, ya no aparece ni puede entrar." />}
        </div>
        {necesitaPin && <p className="mt-2 text-sm text-rojo">Un administrador necesita PIN. Escríbele uno arriba.</p>}
      </Carta>
      {!nuevo && !esYo && ctx.nueva && <button className="btn btn-linea !text-lg !text-rojo" onClick={() => setBorrar(true)}>Eliminar a {x.nombre}</button>}
      {borrar && <Confirmar titulo={`¿Eliminar a ${x.nombre}?`} texto="Solo se puede si nunca tuvo citas. Si ya tuvo, apaga «Activo» para que ya no aparezca ni pueda entrar." si="Sí, eliminar"
        onNo={() => setBorrar(false)} onSi={async () => { setBorrar(false); if (await ctx.correr(() => api(`/barberos/${x.id}`, undefined, 'DELETE'), `${x.nombre} eliminado.`)) onVolver(); }} />}
    </Sub>
  );
}

// ---------- Usuarios con correo ----------
function SecUsuarios({ ctx }: { ctx: Ctx }) {
  const { datos, recargar } = useDatos<any>('/usuarios');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [quitar, setQuitar] = useState<any>(null);
  const valido = /^\S+@\S+\.\S+$/.test(email.trim());
  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    const correo = email.trim().toLowerCase();
    const r = await ctx.correr(() => api<any>('/usuarios', { nombre, email: correo }),
      (r) => (r?.invitado ? `Listo. Le enviamos un correo a ${correo} con el enlace.` : `Listo. ${correo} ya puede entrar con su correo.`));
    if (r) { setNombre(''); setEmail(''); recargar(); }
  }
  return (
    <Sub titulo="Usuarios con correo" volver={ctx.volver}>
      <p className="text-tenue">Pueden entrar al panel desde <b className="text-crema">Soy el dueño</b>: escriben su correo, les llega un código de 6 números y después pueden activar Face ID o huella. Tienen los mismos permisos que el dueño.</p>
      {!datos ? <Cargando /> : (
        <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-carta">
          {datos.usuarios.map((u: any) => (
            <li key={u.email} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-borde"><Icono nombre="correo" className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                {u.nombre && <span className="block truncate font-semibold">{u.nombre}</span>}
                <span className={`block truncate ${u.nombre ? 'text-sm text-tenue' : 'font-semibold'}`}>{u.email}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {u.yo && <Insignia tono="verde">Tú</Insignia>}
                  {u.principal && <Insignia tono="azul">Principal</Insignia>}
                  {u.passkeys > 0 && <Insignia>Face ID activo</Insignia>}
                </span>
              </span>
              {u.id && !u.principal && !u.yo && <button className="shrink-0 rounded-xl border-2 border-borde px-3 py-2 text-sm font-semibold text-rojo" onClick={() => setQuitar(u)}>Quitar</button>}
            </li>
          ))}
        </ul>
      )}
      <Carta>
        <form className="grid gap-3" onSubmit={agregar}>
          <h3 className="titulo text-2xl">Dar acceso a alguien</h3>
          <Campo etiqueta="Nombre (opcional)"><input className="campo" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Socio, contador" /></Campo>
          <Campo etiqueta="Correo"><input className="campo" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" /></Campo>
          <button className="btn btn-rojo" disabled={!valido}>Dar acceso</button>
        </form>
      </Carta>
      <p className="text-sm text-tenue">Para el personal que entra con PIN, ve a <b>Equipo</b>.</p>
      {quitar && <Confirmar titulo="¿Quitar acceso?" texto={`${quitar.email} ya no podrá entrar al panel y se cerrarán sus sesiones.`} si="Sí, quitar"
        onNo={() => setQuitar(null)} onSi={async () => { const u = quitar; setQuitar(null); if (await ctx.correr(() => api(`/usuarios/${u.id}`, undefined, 'DELETE'), 'Acceso quitado.')) recargar(); }} />}
    </Sub>
  );
}
