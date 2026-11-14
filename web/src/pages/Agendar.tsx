import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorApi, L, api, cuandoTexto, dispositivo, memoria } from '../api';
import { Aviso, Cargando, Logo, Pagina, SelectorHora, useDatos } from '../ui';

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined;

function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITEKEY) return;
    const pintar = () => (window as any).turnstile?.render(ref.current, { sitekey: SITEKEY, theme: 'dark', callback: onToken });
    if ((window as any).turnstile) { pintar(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = pintar;
    document.head.appendChild(s);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return SITEKEY ? <div ref={ref} className="mt-4 flex justify-center" /> : null;
}

export default function Agendar() {
  const nav = useNavigate();
  const { datos } = useDatos<any>('/barberia');
  const [paso, setPaso] = useState(1);
  const [nombre, setNombre] = useState(memoria.leer('ty_nombre') ?? '');
  const [tel, setTel] = useState('');
  const [servicios, setServicios] = useState<number[]>([]);
  const [barbero, setBarbero] = useState<number | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [ts, setTs] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); setError(''); }, [paso]);

  if (!datos) return <Pagina><Logo /><Cargando /></Pagina>;
  const { barberia: b, barberos, ahora } = datos;
  const elegidos = datos.servicios.filter((s: any) => servicios.includes(s.id));
  const total = elegidos.reduce((t: number, s: any) => t + s.precio_l, 0);
  const telOk = tel.replace(/\D/g, '').length === 0 || tel.replace(/\D/g, '').length === 8;
  const nombreBarbero = barbero ? barberos.find((x: any) => x.id === barbero)?.nombre : 'El primero libre';

  async function confirmar() {
    setEnviando(true); setError('');
    try {
      const r = await api('/citas', { nombre, telefono: tel || undefined, servicios, barbero_id: barbero, inicio, dispositivo: dispositivo(), turnstile: ts });
      memoria.guardar('ty_cita', r.codigo); memoria.guardar('ty_nombre', nombre);
      nav(`/c/${r.codigo}?nueva=1`, { replace: true });
    } catch (e) {
      const x = e as ErrorApi;
      if (x.datos?.codigo) { memoria.guardar('ty_cita', x.datos.codigo); nav(`/c/${x.datos.codigo}`, { replace: true }); return; }
      setError(x.message);
      if (x.estado === 409) { setInicio(null); setPaso(3); }
    } finally { setEnviando(false); }
  }

  return (
    <Pagina>
      <div className="flex items-center justify-between">
        <Logo />
        <Link to="/" className="text-sm text-tenue underline">Salir</Link>
      </div>
      <div className="mt-4" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={paso} aria-label={`Paso ${paso} de 4`}>
        <div className="h-3 overflow-hidden rounded-full bg-carta"><div className="poste h-full rounded-full transition-all" style={{ width: `${paso * 25}%` }} /></div>
        <div className="mt-1 text-sm text-tenue">Paso {paso} de 4</div>
      </div>

      {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}

      {paso === 1 && (
        <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (nombre.trim().length >= 2 && telOk) setPaso(2); }}>
          <h1 className="titulo text-5xl">¿Cómo te llamas?</h1>
          <label className="mt-5 block text-sm text-tenue" htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" className="campo mt-1" autoComplete="name" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Óscar López" />
          <label className="mt-4 block text-sm text-tenue" htmlFor="tel">WhatsApp (opcional)</label>
          <div className="mt-1 flex gap-2">
            <span className="campo !w-auto text-tenue">+504</span>
            <input id="tel" className="campo" inputMode="numeric" autoComplete="tel-national" maxLength={9} value={tel} onChange={(e) => setTel(e.target.value.replace(/[^\d-]/g, ''))} placeholder="9999-9999" aria-invalid={!telOk} />
          </div>
          {!telOk && <p className="mt-1 text-sm text-rojo">El número debe tener 8 dígitos.</p>}
          <p className="mt-2 text-sm text-tenue">Solo para avisarte de tu cita. Lo borramos a los 90 días. <Link className="underline" to="/privacidad">Aviso de privacidad</Link></p>
          <button className="btn btn-rojo mt-6" disabled={nombre.trim().length < 2 || !telOk}>Siguiente</button>
        </form>
      )}

      {paso === 2 && (
        <div className="mt-5">
          <h1 className="titulo text-5xl">¿Qué te haces?</h1>
          <p className="mt-1 text-tenue">Puedes elegir más de uno.</p>
          <div className="mt-4 grid gap-3">
            {datos.servicios.map((s: any) => {
              const on = servicios.includes(s.id);
              return (
                <button key={s.id} aria-pressed={on} onClick={() => setServicios(on ? servicios.filter((x) => x !== s.id) : [...servicios, s.id])}
                  className={`flex items-center justify-between rounded-2xl border-2 p-4 text-left ${on ? 'border-azul bg-azul/15' : 'border-borde bg-carta'}`}>
                  <div><div className="titulo text-3xl">{s.nombre}</div><div className="text-sm text-tenue">{s.descripcion}</div></div>
                  <div className="text-right"><div className="titulo text-4xl">{L(s.precio_l)}</div><div className="text-sm">{on ? '✓ Elegido' : 'Tocar para elegir'}</div></div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-lg"><span className="text-tenue">Total</span><span className="titulo text-4xl">{L(total)}</span></div>
          <button className="btn btn-rojo mt-4" disabled={!servicios.length} onClick={() => setPaso(3)}>Siguiente</button>
          <button className="btn btn-linea mt-2" onClick={() => setPaso(1)}>Atrás</button>
        </div>
      )}

      {paso === 3 && (
        <div className="mt-5">
          <h1 className="titulo text-5xl">¿Cuándo y con quién?</h1>
          {barberos.length > 1 && (
            <div className="mt-4 grid gap-2">
              {[{ id: null, nombre: 'El primero libre', apodo: 'Más horas para elegir' }, ...barberos].map((x: any) => (
                <button key={x.id ?? 0} aria-pressed={barbero === x.id} onClick={() => setBarbero(x.id)}
                  className={`rounded-xl border-2 px-4 py-3 text-left ${barbero === x.id ? 'border-azul bg-azul/15' : 'border-borde bg-carta'}`}>
                  <div className="titulo text-2xl">{x.nombre}</div>
                  {x.apodo && <div className="text-sm text-tenue">{x.id ? `“${x.apodo}”` : x.apodo}</div>}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5">
            <SelectorHora hoy={ahora.slice(0, 10)} dias={b.dias_anticipacion} horario={b.horario} barbero={barbero} valor={inicio} onElegir={setInicio} />
          </div>
          <button className="btn btn-rojo mt-5" disabled={!inicio} onClick={() => setPaso(4)}>Siguiente</button>
          <button className="btn btn-linea mt-2" onClick={() => setPaso(2)}>Atrás</button>
        </div>
      )}

      {paso === 4 && inicio && (
        <div className="mt-5">
          <h1 className="titulo text-5xl">Confirma tu cita</h1>
          <div className="ticket mt-4 p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
              <dt className="text-tenue">Nombre</dt><dd className="text-right font-semibold">{nombre}</dd>
              <dt className="text-tenue">Cuándo</dt><dd className="titulo text-right text-3xl">{cuandoTexto(inicio, ahora)}</dd>
              <dt className="text-tenue">Barbero</dt><dd className="text-right font-semibold">{nombreBarbero}</dd>
              <dt className="text-tenue">Servicio</dt><dd className="text-right font-semibold">{elegidos.map((s: any) => s.nombre).join(' + ')}</dd>
              <dt className="text-tenue">Total</dt><dd className="titulo text-right text-3xl">{L(total)}</dd>
            </dl>
          </div>
          <p className="mt-3 text-sm text-tenue">Llega puntual. Te esperamos {b.tolerancia_min} minutos; después la hora se pierde y recuperarla tiene un recargo de {L(b.recargo_l)}.</p>
          <Turnstile onToken={setTs} />
          <button className="btn btn-rojo mt-5 !min-h-[4.5rem] !text-3xl" disabled={enviando || (!!SITEKEY && !ts)} onClick={confirmar}>
            {enviando ? 'Reservando…' : 'Reservar mi cita'}
          </button>
          <button className="btn btn-linea mt-2" onClick={() => setPaso(3)}>Atrás</button>
        </div>
      )}
    </Pagina>
  );
}
