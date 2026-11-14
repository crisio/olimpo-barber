import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { L, api, cuandoTexto, duracion, hora12, memoria, minutosEntre } from '../api';
import { Aviso, Cargando, Confirmar, Logo, Pagina, Poste, SelectorHora, useDatos } from '../ui';

function avisar() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.35);
  } catch { /* el navegador puede bloquear el sonido */ }
}

export default function Cita() {
  const { codigo = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { datos, error, recargar } = useDatos<any>(`/citas/${codigo}`, 20000);
  const [dialogo, setDialogo] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [nueva, setNueva] = useState<string | null>(null);
  const [fallo, setFallo] = useState('');
  const [moviendo, setMoviendo] = useState(false);
  const [qr, setQr] = useState('');
  const fase = useRef('');
  useEffect(() => { QRCode.toDataURL(location.href.split('?')[0], { width: 320, margin: 1 }).then(setQr).catch(() => {}); }, [codigo]);

  const c = datos?.cita, ahora: string = datos?.ahora ?? '';
  const faltan = c ? minutosEntre(ahora, c.inicio) : 0;
  const { datos: disp } = useDatos<any>(c?.estado === 'agendada' && faltan > 0 ? `/disponibilidad?fecha=${c.inicio.slice(0, 10)}` : null, 30000);
  const antes = c && disp?.horas.find((h: any) => h.barberos.length && h.inicio < c.inicio);
  const faseActual = !c ? '' : c.estado !== 'agendada' ? c.estado : faltan <= 0 ? 'ya' : faltan <= 60 ? 'cerca' : 'lejos';
  useEffect(() => {
    if (faseActual && fase.current && fase.current !== faseActual) avisar();
    fase.current = faseActual;
  }, [faseActual]);

  if (error && !datos) return (
    <Pagina><Logo /><div className="mt-6"><Aviso>{error.message}</Aviso></div>
      <Link to="/" className="btn btn-crema mt-4" onClick={() => memoria.guardar('ty_cita', null)}>Ir al inicio</Link></Pagina>
  );
  if (!c) return <Pagina><Logo /><Cargando /></Pagina>;
  const b = datos.barberia;
  const servicios = c.servicios.map((s: any) => s.nombre).join(' + ');
  const tolerancia = b.tolerancia_min + faltan; // minutos de tolerancia que quedan cuando ya empezó
  const wa = b.whatsapp_numero && `https://wa.me/${b.whatsapp_numero}?text=${encodeURIComponent(`Hola, quiero avisos de mi cita. Mi código es ${c.codigo}`)}`;

  async function cancelar() {
    setDialogo(false);
    try { await api(`/citas/${codigo}/cancelar`, {}); recargar(); } catch (e: any) { setFallo(e.message); }
  }
  async function mover(inicio: string | null) {
    if (!inicio) return;
    try { await api(`/citas/${codigo}/mover`, { inicio }); setMoviendo(false); setNueva(null); setFallo(''); recargar(); }
    catch (e: any) { setFallo(e.message); setNueva(null); }
  }
  async function recuperar() {
    try {
      const r = await api(`/citas/${codigo}/recuperar`, { inicio: nueva });
      memoria.guardar('ty_cita', r.codigo);
      setRecuperando(false); setNueva(null);
      nav(`/c/${r.codigo}?nueva=1`, { replace: true });
    } catch (e: any) { setFallo(e.message); setNueva(null); }
  }

  const tono = c.estado === 'agendada' ? (faltan <= 0 ? 'bg-rojo text-white' : faltan <= 60 ? 'bg-azul text-white' : 'bg-carta') :
    c.estado === 'en_atencion' ? 'bg-verde text-white' : 'bg-carta';

  return (
    <Pagina>
      <Logo />
      <Poste className="mt-4" />
      {fallo && <div className="mt-4"><Aviso>{fallo}</Aviso></div>}
      {params.get('nueva') && c.estado === 'agendada' && (
        <div className="mt-4"><Aviso tono="verde"><b>¡Listo, {c.nombre_publico}!</b> Tu cita quedó reservada. Guarda esta pantalla.</Aviso></div>
      )}

      <section className={`mt-4 rounded-2xl border border-borde p-5 text-center ${tono}`} aria-live="polite">
        {c.estado === 'agendada' && faltan > 60 && (<>
          <div className="text-sm uppercase tracking-widest opacity-80">Tu cita con {c.barbero}</div>
          <div className="titulo mt-2 text-6xl">{cuandoTexto(c.inicio, ahora).replace(' · ', ' ')}</div>
          <div className="mt-2 text-lg">Faltan ≈ {duracion(faltan)}</div>
        </>)}
        {c.estado === 'agendada' && faltan > 0 && faltan <= 60 && (<>
          <div className="titulo text-5xl">¡Ya casi, ve saliendo!</div>
          <div className="titulo mt-2 text-7xl">{hora12(c.inicio.slice(11))}</div>
          <div className="mt-2 text-lg">Faltan {duracion(faltan)} · {c.barbero} te espera</div>
          <div className="mt-2 text-sm opacity-90">Llega puntual: después de {b.tolerancia_min} min pierdes la hora y recuperarla cuesta {L(b.recargo_l)} más.</div>
        </>)}
        {c.estado === 'agendada' && faltan <= 0 && (<>
          <div className="titulo text-5xl">Tu hora ya empezó</div>
          <div className="titulo mt-2 text-7xl">{tolerancia > 0 ? `${tolerancia} min` : 'Tiempo agotado'}</div>
          <div className="mt-2 text-lg">{tolerancia > 0 ? `de tolerancia. Avísale a ${c.barbero} cuando llegues.` : `Pasaron los ${b.tolerancia_min} min de tolerancia.`}</div>
          <div className="mt-2 rounded-xl bg-black/25 px-3 py-2 font-semibold">{tolerancia > 0 ? `Si pasas de ${b.tolerancia_min} min pierdes la hora, y recuperarla cuesta ${L(b.recargo_l)} más.` : `Vas tarde: si pierdes la hora, recuperarla cuesta ${L(b.recargo_l)} más.`}</div>
        </>)}
        {c.estado === 'en_atencion' && (<><div className="titulo text-6xl">Estás en la silla</div><div className="mt-2 text-lg">{c.barbero} te está atendiendo.</div></>)}
        {c.estado === 'terminada' && (<><div className="titulo text-6xl">¡Gracias, {c.nombre_publico}!</div><div className="mt-2 text-lg text-tenue">Te esperamos en tu próximo corte.</div></>)}
        {c.estado === 'cancelada' && (<><div className="titulo text-5xl">Cita cancelada</div><div className="mt-2 text-lg text-tenue">La hora quedó libre para alguien más.</div></>)}
        {c.estado === 'no_llego' && (<>
          <div className="titulo text-5xl text-rojo">Perdiste tu hora</div>
          <div className="mt-2 text-lg">Pasaron los {b.tolerancia_min} minutos de tolerancia.</div>
          {!c.recuperada && <div className="mt-1 text-tenue">Puedes recuperarla en otra hora con un recargo de {L(b.recargo_l)}.</div>}
        </>)}
      </section>

      {c.estado === 'agendada' && (
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-carta" aria-hidden="true">
          <div className="poste poste-anim h-full rounded-full" style={{ width: `${Math.min(100, Math.max(6, 100 - (faltan / 180) * 100))}%` }} />
        </div>
      )}

      <div className="ticket mt-4 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm uppercase tracking-widest text-tenue">Código</span>
          <span className="titulo text-4xl tracking-widest">{c.codigo}</span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t-2 border-dashed border-borde pt-3">
          <dt className="text-tenue">Cliente</dt><dd className="text-right font-semibold">{c.nombre_publico}</dd>
          <dt className="text-tenue">Cuándo</dt><dd className="text-right font-semibold">{cuandoTexto(c.inicio, ahora)}</dd>
          <dt className="text-tenue">Barbero</dt><dd className="text-right font-semibold">{c.barbero}</dd>
          <dt className="text-tenue">Servicio</dt><dd className="text-right font-semibold">{servicios}</dd>
          {c.recargo_l > 0 && (<><dt className="text-tenue">Recargo</dt><dd className="text-right font-semibold">{L(c.recargo_l)}</dd></>)}
          <dt className="text-tenue">Total</dt><dd className="titulo text-right text-3xl">{L(c.total_l)}</dd>
        </dl>
        <p className="mt-3 text-sm text-tenue">{b.nombre} · {b.direccion}</p>
        {qr && ['agendada', 'en_atencion'].includes(c.estado) && (
          <div className="mt-3 flex items-center gap-3 border-t-2 border-dashed border-borde pt-3">
            <img src={qr} alt={`Código QR de la cita ${c.codigo}`} className="h-24 w-24 rounded-lg bg-white p-1" />
            <p className="text-sm text-tenue">Muestra este código o el QR al barbero cuando llegues.</p>
          </div>
        )}
      </div>

      {antes && !moviendo && (
        <div className="mt-4 rounded-2xl border-2 border-verde bg-verde/15 p-4">
          <div className="font-semibold">Hay una hora libre antes que la tuya</div>
          <button className="btn btn-verde mt-2" onClick={() => mover(antes.inicio)}>Adelantar a las {hora12(antes.hora)}</button>
        </div>
      )}
      {c.estado === 'agendada' && faltan > 0 && (
        moviendo ? (
          <div className="mt-5">
            <h2 className="titulo text-3xl">Elige la nueva hora</h2>
            <div className="mt-3"><SelectorHora hoy={ahora.slice(0, 10)} dias={b.dias_anticipacion} horario={b.horario} barbero={null} valor={nueva} onElegir={setNueva} /></div>
            <button className="btn btn-azul mt-4" disabled={!nueva} onClick={() => mover(nueva)}>Cambiar mi cita</button>
            <button className="btn btn-linea mt-2" onClick={() => { setMoviendo(false); setNueva(null); }}>Dejarla como está</button>
          </div>
        ) : <button className="btn btn-linea mt-4" onClick={() => setMoviendo(true)}>Cambiar hora</button>
      )}

      {c.estado === 'agendada' && wa && (
        c.con_whatsapp
          ? <a href={wa} className="btn btn-linea mt-4">Escribir a la barbería por WhatsApp</a>
          : <><a href={wa} className="btn btn-verde mt-4">Avisarme por WhatsApp</a>
              <p className="mt-2 text-center text-sm text-tenue">Se abre tu WhatsApp con un mensaje listo. Envíalo y te recordamos la cita por ahí.</p></>
      )}

      {c.estado === 'no_llego' && !c.recuperada && (
        recuperando ? (
          <div className="mt-5">
            <h2 className="titulo text-3xl">Elige tu nueva hora</h2>
            <div className="mt-3"><SelectorHora hoy={ahora.slice(0, 10)} dias={b.dias_anticipacion} horario={b.horario} barbero={null} valor={nueva} onElegir={setNueva} /></div>
            <button className="btn btn-rojo mt-4" disabled={!nueva} onClick={recuperar}>Recuperar por {L(c.total_l + b.recargo_l)}</button>
            <p className="mt-2 text-center text-sm text-tenue">Incluye {L(b.recargo_l)} de recargo. Se paga en la barbería.</p>
          </div>
        ) : <button className="btn btn-rojo mt-4" onClick={() => setRecuperando(true)}>Recuperar mi cita (+{L(b.recargo_l)})</button>
      )}

      {['terminada', 'cancelada'].includes(c.estado) || (c.estado === 'no_llego' && c.recuperada)
        ? <Link to="/agendar" className="btn btn-rojo mt-4" onClick={() => memoria.guardar('ty_cita', null)}>Agendar otra cita</Link> : null}
      {c.estado === 'agendada' && <button className="btn btn-linea mt-6 !text-lg text-tenue" onClick={() => setDialogo(true)}>Cancelar mi cita</button>}

      <p className="mt-8 text-center text-xs text-tenue">Usamos tu nombre para llamarte y tu teléfono solo para avisarte. No lo compartimos ni lo mostramos en pantallas.</p>
      {dialogo && <Confirmar titulo="¿Cancelar tu cita?" texto={`Se libera tu hora del ${cuandoTexto(c.inicio, ahora)}.`} si="Sí, cancelar" onSi={cancelar} onNo={() => setDialogo(false)} />}
    </Pagina>
  );
}
