import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { L, cuandoTexto, diaSemana, hora12, memoria, sumarDias } from '../api';
import { Aviso, Carta, Cargando, Logo, Pagina, Poste, useDatos } from '../ui';
import Transferencia from '../Transferencia';

export function estadoHorario(horario: Record<string, [string, string] | null>, ahora: string) {
  const hoy = ahora.slice(0, 10), hm = ahora.slice(11);
  const r = horario[String(diaSemana(hoy))];
  if (r && hm >= r[0] && hm < r[1]) return { abierto: true, texto: `Abierto hasta ${hora12(r[1])}` };
  if (r && hm < r[0]) return { abierto: false, texto: `Cerrado · abre hoy ${hora12(r[0])}` };
  for (let i = 1; i <= 7; i++) {
    const f = sumarDias(hoy, i), s = horario[String(diaSemana(f))];
    if (s) return { abierto: false, texto: `Cerrado · abre ${i === 1 ? 'mañana' : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][diaSemana(f)]} ${hora12(s[0])}` };
  }
  return { abierto: false, texto: 'Cerrado' };
}

export default function Inicio() {
  const nav = useNavigate();
  const { datos, error } = useDatos<any>('/barberia', 30000);
  const miCita = memoria.leer('ty_cita');
  const { datos: mia } = useDatos<any>(miCita ? `/citas/${miCita}` : null);
  useEffect(() => {
    // Al volver a escanear el QR, regresa a su cita si sigue viva
    if (mia?.cita && ['agendada', 'en_atencion'].includes(mia.cita.estado) && !sessionStorage.getItem('ty_visto')) {
      sessionStorage.setItem('ty_visto', '1');
      nav(`/c/${mia.cita.codigo}`);
    }
  }, [mia, nav]);

  if (error && !datos) return <Pagina><Logo /><div className="mt-6"><Aviso>{error.message}</Aviso></div></Pagina>;
  if (!datos) return <Pagina><Logo /><Cargando /></Pagina>;
  const { barberia: b, servicios, proxima_libre, ahora } = datos;
  const h = estadoHorario(b.horario, ahora);
  const viva = mia?.cita && ['agendada', 'en_atencion', 'no_llego'].includes(mia.cita.estado) && !mia.cita.recuperada;

  return (
    <Pagina>
      <Logo grande />
      <Poste className="mt-4" />
      {b.descripcion && <p className="mt-4 whitespace-pre-line text-lg">{b.descripcion}</p>}
      {b.direccion && (
        <p className="mt-4 text-tenue">
          {b.direccion}{' · '}
          <a className="underline" target="_blank" rel="noopener noreferrer"
            href={b.mapa_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.nombre}, ${b.direccion}`)}`}>Cómo llegar</a>
        </p>
      )}
      <p className="mt-1 flex items-center gap-2 font-semibold">
        <span className={`inline-block h-3 w-3 rounded-full ${h.abierto ? 'bg-verde' : 'bg-rojo'}`} aria-hidden="true" />{h.texto}
      </p>

      {viva && (
        <Link to={`/c/${mia.cita.codigo}`} className="mt-4 block rounded-2xl border-2 border-azul bg-azul/15 p-4">
          <div className="text-sm uppercase tracking-widest text-tenue">Tu cita</div>
          <div className="titulo text-3xl">{cuandoTexto(mia.cita.inicio, ahora)}</div>
          <div className="text-sm underline">Ver mi cita →</div>
        </Link>
      )}

      <Carta className="mt-4 text-center">
        <div className="text-sm uppercase tracking-widest text-tenue">Próxima hora libre</div>
        {!b.agenda_abierta ? <div className="titulo mt-2 text-4xl text-rojo">Agenda cerrada</div>
          : proxima_libre ? <div className="titulo mt-2 text-6xl">{cuandoTexto(proxima_libre, ahora).replace(' · ', ' ')}</div>
          : <div className="titulo mt-2 text-4xl">Sin horas esta semana</div>}
        <p className="mt-2 text-sm text-tenue">Reservas tu hora y llegas directo, sin esperar en la barbería.</p>
      </Carta>

      <Link to="/agendar" className={`btn btn-rojo mt-4 !min-h-[4.5rem] !text-3xl ${b.agenda_abierta ? '' : 'pointer-events-none opacity-40'}`} aria-disabled={!b.agenda_abierta}>
        Agendar mi cita
      </Link>
      <p className="mt-3 text-center text-sm text-tenue">Gratis · sin descargar nada · sin crear cuenta</p>

      <h2 className="titulo mt-8 text-3xl">Servicios</h2>
      <div className="mt-3 grid gap-2">
        {servicios.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-borde bg-carta px-4 py-3">
            <div><div className="titulo text-2xl">{s.nombre}</div><div className="text-sm text-tenue">{s.descripcion}</div></div>
            <div className="titulo text-3xl text-crema">{L(s.precio_l)}</div>
          </div>
        ))}
      </div>

      <Transferencia b={b} />

      <h2 className="titulo mt-8 text-3xl">Cómo funciona</h2>
      <ol className="mt-3 grid gap-2 text-base">
        <li className="rounded-xl border border-borde bg-carta px-4 py-3"><b>1.</b> Eliges día y hora{b.anticipacion_min ? `, al menos ${b.anticipacion_min >= 60 ? `${b.anticipacion_min / 60} h` : `${b.anticipacion_min} min`} antes` : ''}. Cada cita dura {b.duracion_cita_min} minutos.</li>
        <li className="rounded-xl border border-borde bg-carta px-4 py-3"><b>2.</b> Llega puntual: te esperamos {b.tolerancia_min} minutos.</li>
        <li className="rounded-xl border border-borde bg-carta px-4 py-3"><b>3.</b> ¿No puedes ir? Cancela desde tu cita y la hora queda libre para otra persona.</li>
        <li className="rounded-xl border border-borde bg-carta px-4 py-3"><b>4.</b> Si pasan los {b.tolerancia_min} minutos, la hora se pierde. Recuperarla tiene un recargo de {L(b.recargo_l)}.</li>
      </ol>

      <Contacto b={b} />

      <footer className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-tenue">
        <Link className="underline" to="/privacidad">Aviso de privacidad</Link>
        <Link className="underline" to="/barbero">Soy barbero</Link>
        <Link className="underline" to="/dueno">Soy el dueño</Link>
      </footer>
    </Pagina>
  );
}

/** WhatsApp y redes sociales del negocio, si el dueño los configuró. */
function Contacto({ b }: { b: any }) {
  const redes = [
    b.whatsapp_numero && { texto: 'WhatsApp', url: `https://wa.me/${b.whatsapp_numero}` },
    b.instagram && { texto: 'Instagram', url: `https://instagram.com/${b.instagram}` },
    b.facebook && { texto: 'Facebook', url: /^https?:\/\//.test(b.facebook) ? b.facebook : `https://facebook.com/${b.facebook}` },
    b.tiktok && { texto: 'TikTok', url: `https://www.tiktok.com/@${b.tiktok}` },
  ].filter(Boolean) as { texto: string; url: string }[];
  if (!redes.length) return null;
  return (
    <>
      <h2 className="titulo mt-8 text-3xl">Síguenos</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {redes.map((r) => (
          <a key={r.texto} href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-linea !min-h-12 !text-lg">{r.texto}</a>
        ))}
      </div>
    </>
  );
}
