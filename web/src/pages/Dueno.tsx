import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { API, DEMO, L, api, hora12, token } from '../api';
import Agenda from '../Agenda';
import Configuracion from '../Configuracion';
import CompartirQR, { urlPublica } from '../CompartirQR';
import { CambiarPin } from './Barbero';
import Notificaciones from '../Notificaciones';
import { Aviso, Carta, Cargando, Logo, Pagina, Poste, useDatos } from '../ui';

const PESTANAS = ['Panel', 'Agenda', 'Configuración', 'Clientes', 'WhatsApp', 'Actividad', 'Cartel'] as const;

export default function Dueno() {
  const [dentro, setDentro] = useState(!!token.leer());
  const { datos: yo, error, recargar } = useDatos<any>(dentro ? '/auth/yo' : null);
  const [tab, setTab] = useState<(typeof PESTANAS)[number]>('Panel');
  const [vuelta, setVuelta] = useState(0); // tocar otra vez Configuración regresa a su menú
  if (dentro && error?.estado === 401) { token.guardar(null); setDentro(false); }
  if (!dentro) return <Entrar onListo={() => setDentro(true)} />;
  if (!yo) return <Pagina><Logo /><Cargando /></Pagina>;
  if (yo.cambiar_pin) return <CambiarPin onListo={recargar} />;
  if (yo.rol !== 'dueno') return <Pagina><Logo /><div className="mt-6"><Aviso>Esta sección es solo para el dueño.</Aviso></div><Link className="btn btn-crema mt-4" to="/barbero">Ir a mi agenda</Link></Pagina>;
  return (
    <Pagina ancho="max-w-2xl">
      <div className="no-imprimir">
        <div className="flex items-center justify-between">
          <Logo />
          <button className="text-sm text-tenue underline" onClick={async () => { await api('/auth/salir', {}).catch(() => {}); token.guardar(null); setDentro(false); }}>Salir</button>
        </div>
        <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Secciones">
          {PESTANAS.map((p) => (
            <button key={p} aria-current={tab === p ? 'page' : undefined} onClick={() => { if (tab === p) setVuelta((v) => v + 1); setTab(p); }}
              className={`titulo shrink-0 rounded-xl border-2 px-4 py-2 text-xl ${tab === p ? 'border-crema bg-crema text-fondo' : 'border-borde'}`}>{p}</button>
          ))}
        </nav>
      </div>
      <div className="mt-4">
        {tab === 'Panel' && <Panel yo={yo} onPasskey={recargar} />}
        {tab === 'Agenda' && <Agenda rol="dueno" />}
        {tab === 'Configuración' && <Configuracion key={vuelta} yo={yo} />}
        {tab === 'Clientes' && <Clientes />}
        {tab === 'WhatsApp' && <WhatsApp />}
        {tab === 'Actividad' && <Actividad />}
        {tab === 'Cartel' && <Cartel barberoId={yo.atiende ? yo.barbero_id : null} />}
      </div>
    </Pagina>
  );
}

function Entrar({ onListo }: { onListo: () => void }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [fallo, setFallo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function intentar(fn: () => Promise<void>) {
    setOcupado(true); setFallo('');
    try { await fn(); } catch (e: any) { setFallo(e?.name === 'NotAllowedError' ? 'Se canceló la verificación.' : e.message); } finally { setOcupado(false); }
  }
  const pedir = () => intentar(async () => {
    const r = await api('/auth/codigo', { email });
    setEnviado(true);
    if (r.codigo_dev) setCodigo(r.codigo_dev);
  });
  const verificar = () => intentar(async () => { const r = await api('/auth/verificar', { email, codigo }); token.guardar(r.token); onListo(); });
  const faceId = () => intentar(async () => {
    const { opciones, reto_id } = await api('/auth/passkey/login/opciones', {});
    const respuesta = await startAuthentication({ optionsJSON: opciones });
    const r = await api('/auth/passkey/login/verificar', { reto_id, respuesta });
    token.guardar(r.token); onListo();
  });
  return (
    <Pagina>
      <Logo />
      <h1 className="titulo mt-6 text-5xl">Entrada del dueño</h1>
      {fallo && <div className="mt-4"><Aviso>{fallo}</Aviso></div>}
      <button className="btn btn-azul mt-5" disabled={ocupado} onClick={faceId}>Entrar con Face ID o huella</button>
      <p className="mt-2 text-center text-sm text-tenue">Funciona después de activarlo una vez en este dispositivo.</p>
      <div className="my-5 flex items-center gap-3 text-tenue"><div className="h-px flex-1 bg-borde" />o con tu correo<div className="h-px flex-1 bg-borde" /></div>
      {!enviado ? (
        <form onSubmit={(e) => { e.preventDefault(); pedir(); }}>
          <label className="block text-sm text-tenue" htmlFor="email">Correo</label>
          <input id="email" type="email" className="campo mt-1" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          <button className="btn btn-rojo mt-4" disabled={ocupado || !email.includes('@')}>Enviarme un código</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verificar(); }}>
          <p className="text-tenue">Si <b className="text-crema">{email}</b> está autorizado, llegó un código de 6 dígitos. Vence en 10 minutos.</p>
          <label className="mt-3 block text-sm text-tenue" htmlFor="codigo">Código</label>
          <input id="codigo" className="campo titulo mt-1 text-center !text-4xl tracking-[.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
          <button className="btn btn-rojo mt-4" disabled={ocupado || codigo.length !== 6}>Entrar</button>
          <button type="button" className="btn btn-linea mt-2" onClick={() => { setEnviado(false); setCodigo(''); }}>Usar otro correo</button>
        </form>
      )}
      <Link className="btn btn-linea mt-6" to="/barbero">Entrar con mi PIN de barbero</Link>
      <p className="mt-4 text-center text-sm text-tenue"><Link className="underline" to="/">Inicio</Link></p>
    </Pagina>
  );
}

const Dato = ({ titulo, valor, nota }: { titulo: string; valor: string | number; nota?: string }) => (
  <div className="rounded-2xl border border-borde bg-carta p-4">
    <div className="text-sm text-tenue">{titulo}</div>
    <div className="titulo mt-1 text-5xl">{valor}</div>
    {nota && <div className="text-sm text-tenue">{nota}</div>}
  </div>
);

function Panel({ yo, onPasskey }: { yo: any; onPasskey: () => void }) {
  const [rango, setRango] = useState('hoy');
  const { datos: m } = useDatos<any>(`/metricas?rango=${rango}`, 30000);
  const [msj, setMsj] = useState<{ tono: 'verde' | 'rojo'; texto: string } | null>(null);
  async function activar() {
    try {
      const { opciones, reto_id } = await api('/auth/passkey/registro/opciones', {});
      const respuesta = await startRegistration({ optionsJSON: opciones });
      await api('/auth/passkey/registro/verificar', { reto_id, respuesta });
      setMsj({ tono: 'verde', texto: 'Listo. La próxima vez entra con Face ID o huella.' }); onPasskey();
    } catch (e: any) { setMsj({ tono: 'rojo', texto: e?.name === 'NotAllowedError' ? 'Se canceló la activación.' : e.message }); }
  }
  const max = Math.max(1, ...(m?.por_hora ?? []).map((h: any) => h.cantidad));
  return (
    <div>
      <Notificaciones />
      {msj && <div className="mb-3"><Aviso tono={msj.tono}>{msj.texto}</Aviso></div>}
      {yo.passkeys === 0 && !msj && (
        <Carta className="mb-4"><div className="font-semibold">Entra más rápido la próxima vez</div>
          <button className="btn btn-azul mt-3 !min-h-12 !text-lg" onClick={activar}>Activar Face ID o huella en este dispositivo</button></Carta>
      )}
      <div className="flex gap-2" role="tablist" aria-label="Periodo">
        {[['hoy', 'Hoy'], ['semana', '7 días'], ['mes', '30 días']].map(([v, t]) => (
          <button key={v} role="tab" aria-selected={rango === v} onClick={() => setRango(v)} className={`titulo flex-1 rounded-xl border-2 py-2 text-xl ${rango === v ? 'border-azul bg-azul text-white' : 'border-borde'}`}>{t}</button>
        ))}
      </div>
      {!m ? <Cargando /> : (<>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Dato titulo="Clientes atendidos" valor={m.atendidas} nota={`${m.pendientes} por atender`} />
          <Dato titulo="Ingresos" valor={L(m.ingresos_l)} nota={m.recargos_l ? `incluye ${L(m.recargos_l)} en recargos` : 'de citas terminadas'} />
          <Dato titulo="No llegaron" valor={m.no_llego} nota={`${m.canceladas} canceladas`} />
          <Dato titulo="Retraso promedio" valor={`${m.retraso_promedio_min} min`} nota={`máximo ${m.retraso_max_min} min`} />
        </div>
        <h2 className="titulo mt-6 text-3xl">Por barbero</h2>
        <Tabla cab={['Barbero', 'Atendidos', 'No llegó', 'Ingresos']} filas={m.por_barbero.map((b: any) => [b.barbero, b.atendidas, b.no_llego, L(b.ingresos_l)])} />
        <h2 className="titulo mt-6 text-3xl">Por servicio</h2>
        <Tabla cab={['Servicio', 'Cantidad', 'Ingresos']} filas={m.por_servicio.map((s: any) => [s.servicio, s.cantidad, L(s.ingresos_l)])} />
        <h2 className="titulo mt-6 text-3xl">Horas pico</h2>
        {!m.por_hora.length ? <p className="mt-2 text-tenue">Aún no hay citas terminadas en este periodo.</p> : (
          <ul className="mt-2 grid gap-1.5">
            {m.por_hora.map((h: any) => (
              <li key={h.hora} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm text-tenue">{hora12(`${h.hora}:00`)}</span>
                <span className="h-5 rounded bg-azul" style={{ width: `${(h.cantidad / max) * 70}%` }} aria-hidden="true" />
                <span className="font-semibold">{h.cantidad}</span>
              </li>
            ))}
          </ul>
        )}
      </>)}
      <p className="mt-8 text-sm text-tenue">Pantalla para TV: <Link className="underline" to="/pantalla">abrir la agenda en vivo</Link></p>
    </div>
  );
}

function Tabla({ cab, filas }: { cab: string[]; filas: (string | number)[][] }) {
  if (!filas.length) return <p className="mt-2 text-tenue">Sin datos en este periodo.</p>;
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-borde">
      <table className="w-full text-left text-base">
        <thead className="bg-carta text-sm text-tenue"><tr>{cab.map((c, i) => <th key={c} className={`px-3 py-2 font-medium ${i ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((f, i) => <tr key={i} className="border-t border-borde">{f.map((v, j) => <td key={j} className={`px-3 py-2 ${j ? 'text-right tabular-nums' : 'font-semibold'}`}>{v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Clientes() {
  const { datos } = useDatos<any>('/clientes');
  async function bajar() {
    if (DEMO) { alert('La descarga se activa cuando la app esté conectada a Cloudflare.'); return; }
    const r = await fetch(`${API}/api/clientes?formato=csv`, { headers: { authorization: `Bearer ${token.leer()}` } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob()); a.download = 'clientes-olimpo.csv'; a.click();
    URL.revokeObjectURL(a.href);
  }
  if (!datos) return <Cargando />;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="titulo text-3xl">{datos.clientes.length} clientes</h2>
        <button className="btn btn-linea !min-h-11 !w-auto !text-lg" onClick={bajar} disabled={!datos.clientes.length}>Descargar CSV</button>
      </div>
      <p className="mt-1 text-sm text-tenue">Solo aparecen quienes dejaron su WhatsApp. El teléfono se borra 90 días después de la última cita.</p>
      <Tabla cab={['Cliente', 'WhatsApp', 'Avisos', 'Visitas', 'No llegó']}
        filas={datos.clientes.map((c: any) => [c.nombre, c.telefono ? `+${c.telefono}` : 'borrado', c.consentimiento ? (c.wa_verificado ? 'Sí, verificado' : 'Sí') : 'No', c.visitas, c.no_llegadas])} />
    </div>
  );
}

function WhatsApp() {
  const { datos, recargar } = useDatos<any>('/whatsapp/estado', 10000);
  const [tel, setTel] = useState('');
  const [texto, setTexto] = useState('');
  const [msj, setMsj] = useState('');
  if (!datos) return <Cargando />;
  const correr = async (ruta: string, cuerpo: object, ok: (r: any) => string) => {
    try { setMsj(ok(await api(ruta, cuerpo))); recargar(); } catch (e: any) { setMsj(e.message); }
  };
  const ESTADO: Record<string, string> = { simulado: 'Simulado (no se envió)', enviado: 'Enviado', entregado: 'Entregado', leido: 'Leído', error: 'Error', fuera_de_ventana: 'No enviado: fuera de las 24 h', recibido: 'Recibido' };
  return (
    <div className="grid gap-4">
      <Aviso tono={datos.modo === 'real' ? 'verde' : 'azul'}>
        {datos.modo === 'real'
          ? <><b>Conectado a WhatsApp Business.</b> Los avisos se envían de verdad.{!datos.webhook_listo && ' Falta configurar el webhook para recibir mensajes.'}</>
          : <><b>Modo de prueba.</b> Nada se envía a WhatsApp todavía; los mensajes quedan en la bitácora para revisar el flujo. Se activa al cargar las credenciales de Meta (ver README).</>}
      </Aviso>
      <Carta>
        <h2 className="titulo text-3xl">Probar</h2>
        <label className="mt-2 block text-sm text-tenue">Número del cliente (8 dígitos)<input className="campo mt-1" inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="9999-9999" /></label>
        <label className="mt-2 block text-sm text-tenue">Mensaje<input className="campo mt-1" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Hola, mi código es K7P2Q" /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button className="btn btn-linea !text-lg" disabled={!tel} onClick={() => correr('/whatsapp/simular', { telefono: tel, texto }, (r) => r.vinculada ? `Mensaje recibido y vinculado a la cita ${r.codigo}.` : 'Mensaje recibido. No traía un código de cita válido.')}>Simular que el cliente escribe</button>
          <button className="btn btn-azul !text-lg" disabled={!tel} onClick={() => correr('/whatsapp/prueba', { telefono: tel, texto }, (r) => `Resultado: ${ESTADO[r.estado] ?? r.estado}.`)}>Enviar aviso de prueba</button>
        </div>
        {msj && <p className="mt-3 font-semibold" role="status">{msj}</p>}
        <p className="mt-3 text-sm text-tenue">WhatsApp solo permite escribirle gratis a un cliente durante las 24 horas después de que él escribe. Por eso el cliente envía primero su código. Fuera de esas 24 h hace falta una plantilla aprobada{datos.plantilla_recordatorio ? ` (configurada: ${datos.plantilla_recordatorio})` : ', que aún no está configurada'}.</p>
      </Carta>
      <div>
        <h2 className="titulo text-3xl">Bitácora</h2>
        {!datos.mensajes.length && <p className="mt-2 text-tenue">Aún no hay mensajes.</p>}
        <ul className="mt-2 grid gap-2">
          {datos.mensajes.map((m: any) => (
            <li key={m.id} className={`max-w-[90%] rounded-2xl border border-borde p-3 ${m.direccion === 'saliente' ? 'ml-auto bg-azul/15' : 'bg-carta'}`}>
              <div className="text-xs text-tenue">{m.direccion === 'saliente' ? 'Para' : 'De'} +{m.telefono} · {ESTADO[m.estado] ?? m.estado}</div>
              <div className="mt-1 break-words">{m.texto}</div>
              {m.estado === 'error' && m.detalle && <div className="mt-1 break-words text-xs text-rojo">{m.detalle}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const cuando = (iso: string) => new Date(iso).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const nombreQuien = (f: any) => (f.usuario ? f.usuario : `Visitante ${String(f.quien).slice(0, 6)}`);

function Actividad() {
  const [rango, setRango] = useState('hoy');
  const [quien, setQuien] = useState('');
  const { datos } = useDatos<any>(`/eventos/resumen?rango=${rango}${quien ? `&quien=${encodeURIComponent(quien)}` : ''}`, 30000);
  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="Periodo">
        {[['hoy', '24 horas'], ['semana', '7 días'], ['mes', '30 días']].map(([v, t]) => (
          <button key={v} role="tab" aria-selected={rango === v} onClick={() => setRango(v)} className={`titulo flex-1 rounded-xl border-2 py-2 text-xl ${rango === v ? 'border-azul bg-azul text-white' : 'border-borde'}`}>{t}</button>
        ))}
      </div>
      {!datos ? <Cargando /> : (<>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Dato titulo="Toques registrados" valor={datos.total.clics} />
          <Dato titulo="Dispositivos distintos" valor={datos.total.dispositivos} />
        </div>
        <p className="mt-2 text-sm text-tenue">Se registra cada toque en botones y enlaces. Con sesión iniciada aparece el nombre; sin sesión, un identificador anónimo del navegador (una página web no puede leer la MAC del equipo).</p>
        <h2 className="titulo mt-6 text-3xl">Por usuario o dispositivo</h2>
        {!datos.por_quien.length ? <p className="mt-2 text-tenue">Aún no hay actividad en este periodo.</p> : (
          <ul className="mt-2 grid gap-2">
            {datos.por_quien.map((f: any) => (
              <li key={f.quien}>
                <button aria-pressed={quien === f.quien} onClick={() => setQuien(quien === f.quien ? '' : f.quien)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left ${quien === f.quien ? 'border-azul bg-azul/15' : 'border-borde bg-carta'}`}>
                  <span><span className="font-semibold">{nombreQuien(f)}</span><span className="block text-sm text-tenue">Último: {cuando(f.ultimo)}{f.usuario && f.dispositivos > 1 ? ` · ${f.dispositivos} dispositivos` : ''}</span></span>
                  <span className="titulo text-3xl">{f.clics}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <h2 className="titulo mt-6 text-3xl">Lo más tocado{quien ? ' (filtrado)' : ''}</h2>
        <Tabla cab={['Botón o enlace', 'Pantalla', 'Toques']} filas={datos.top.map((t: any) => [t.elemento, t.ruta, t.clics])} />
        <h2 className="titulo mt-6 text-3xl">Últimos toques{quien ? ' (filtrado)' : ''}</h2>
        <Tabla cab={['Quién', 'Botón o enlace', 'Pantalla', 'Cuándo']} filas={datos.recientes.map((r: any) => [nombreQuien(r), r.elemento, r.ruta, cuando(r.creado_en)])} />
      </>)}
    </div>
  );
}

function Cartel({ barberoId }: { barberoId?: number | null }) {
  const url = urlPublica();
  const { datos } = useDatos<any>('/config');
  const [qr, setQr] = useState('');
  useEffect(() => { QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: 'M' }).then(setQr); }, [url]);
  return (
    <div>
      <button className="btn btn-rojo no-imprimir" onClick={() => window.print()}>Imprimir cartel</button>
      <p className="no-imprimir mt-2 text-center text-sm text-tenue">El QR lleva a {url}</p>
      <div className="mx-auto mt-4 max-w-md rounded-3xl bg-white p-6 text-center text-black">
        <Logo grande />
        <Poste className="mx-auto mt-3 !h-3 w-3/4" />
        <div className="titulo mt-5 text-5xl">Agenda tu cita</div>
        <div className="mt-1 text-xl">Escanea y elige tu hora</div>
        {qr && <img src={qr} alt={`Código QR hacia ${url}`} className="mx-auto mt-4 w-4/5" />}
        <div className="mt-3 text-lg font-semibold">Sin descargar nada · sin crear cuenta</div>
        {datos && <div className="mt-1 text-sm">Llega puntual: {datos.barberia.tolerancia_min} minutos de tolerancia</div>}
      </div>
      <div className="no-imprimir mt-10 border-t border-borde pt-6"><CompartirQR barberoId={barberoId} /></div>
    </div>
  );
}
