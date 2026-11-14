import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { DEMO, api, diaCorto, diaTexto, hora12, sumarDias } from './api';
import { EMBLEMA } from './emblema';

export const Emblema = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 400 175" className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: EMBLEMA }} />
);

/** Logo de Olimpo Barber Club: emblema con casco griego, laureles y navaja, y el nombre en serif. */
export function Logo({ grande = false }: { grande?: boolean }) {
  const raya = <span className="h-px w-6 bg-current opacity-70" aria-hidden="true" />;
  if (grande) return (
    <div className="flex flex-col items-center text-center" role="img" aria-label="Olimpo Barber Club">
      <Emblema className="w-64" />
      <div className="marca -mt-1 text-6xl">OLIMPO</div>
      <div className="marca mt-1 flex items-center gap-3 text-lg tracking-[.3em]">{raya}BARBER CLUB{raya}</div>
    </div>
  );
  return (
    <div className="flex items-center gap-2" role="img" aria-label="Olimpo Barber Club">
      <Emblema className="h-12 w-auto" />
      <div>
        <div className="marca text-3xl leading-none">OLIMPO</div>
        <div className="marca mt-1 text-[.7rem] tracking-[.3em]">BARBER CLUB</div>
      </div>
    </div>
  );
}

export const Poste = ({ className = '' }: { className?: string }) => <div className={`poste h-2 rounded-full ${className}`} aria-hidden="true" />;

export function Pagina({ children, ancho = 'max-w-md' }: { children: ReactNode; ancho?: string }) {
  return (
    <>
      {DEMO && <div className="no-imprimir bg-azul px-4 py-2 text-center text-sm font-semibold text-white">Demostración: datos de ejemplo, nada se guarda ni se envía.</div>}
      <main className={`mx-auto ${ancho} px-4 pb-16 pt-5`}>{children}</main>
    </>
  );
}
export const Carta = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <section className={`rounded-2xl border border-borde bg-carta p-4 ${className}`}>{children}</section>;

export const Aviso = ({ children, tono = 'rojo' }: { children: ReactNode; tono?: 'rojo' | 'azul' | 'verde' }) => {
  const c = { rojo: 'border-rojo/60 bg-rojo/15', azul: 'border-azul/60 bg-azul/15', verde: 'border-verde/60 bg-verde/15' }[tono];
  return <div role="alert" className={`rounded-xl border px-4 py-3 text-base ${c}`}>{children}</div>;
};
export const Cargando = () => (
  <div className="py-16" role="status" aria-label="Cargando"><div className="poste poste-anim mx-auto h-3 w-40 rounded-full" /></div>
);

/** Carga datos y los refresca cada cierto tiempo y al volver a la pestaña. */
export function useDatos<T>(ruta: string | null, cadaMs = 0) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const viva = useRef(true);
  const recargar = useCallback(async () => {
    if (!ruta) return;
    try { const d = await api<T>(ruta); if (viva.current) { setDatos(d); setError(null); } }
    catch (e) { if (viva.current) setError(e); }
  }, [ruta]);
  useEffect(() => {
    viva.current = true;
    setDatos(null);
    recargar();
    const t = cadaMs ? setInterval(() => { if (!document.hidden) recargar(); }, cadaMs) : undefined;
    const visible = () => { if (!document.hidden) recargar(); };
    document.addEventListener('visibilitychange', visible);
    return () => { viva.current = false; clearInterval(t); document.removeEventListener('visibilitychange', visible); };
  }, [recargar, cadaMs]);
  return { datos, error, recargar };
}

type Hora = { inicio: string; hora: string; barberos: number[] };
/** Selector de día y hora. barbero = null significa "el primero libre". */
export function SelectorHora({ hoy, dias, horario, barbero, valor, onElegir }: {
  hoy: string; dias: number; horario: Record<string, [string, string] | null>; barbero: number | null;
  valor: string | null; onElegir: (inicio: string | null) => void;
}) {
  const fechas = Array.from({ length: dias + 1 }, (_, i) => sumarDias(hoy, i));
  const abiertas = fechas.filter((f) => horario[String(new Date(f + 'T00:00:00Z').getUTCDay())]);
  const [fecha, setFecha] = useState(valor?.slice(0, 10) ?? abiertas[0] ?? hoy);
  const { datos } = useDatos<{ horas: Hora[] }>(`/disponibilidad?fecha=${fecha}`, 30000);
  const libres = (h: Hora) => (barbero ? h.barberos.includes(barbero) : h.barberos.length > 0);
  useEffect(() => {
    // Si la hora elegida dejó de estar libre, se suelta
    if (valor && datos && valor.slice(0, 10) === fecha && !datos.horas.some((h) => h.inicio === valor && libres(h))) onElegir(null);
  }, [datos, barbero]); // eslint-disable-line react-hooks/exhaustive-deps
  const hayLibres = datos?.horas.some(libres);
  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist" aria-label="Día">
        {abiertas.map((f) => {
          const d = diaCorto(f), activo = f === fecha;
          return (
            <button key={f} role="tab" aria-selected={activo} onClick={() => { setFecha(f); onElegir(null); }}
              className={`shrink-0 rounded-xl border-2 px-3 py-2 text-center ${activo ? 'border-crema bg-crema text-fondo' : 'border-borde bg-carta'}`}>
              <div className="text-xs uppercase">{f === hoy ? 'hoy' : d.dia}</div>
              <div className="titulo text-3xl">{d.num}</div>
            </button>
          );
        })}
      </div>
      {!datos ? <Cargando /> : !hayLibres ? (
        <p className="py-6 text-center text-tenue">No quedan horas libres {diaTexto(fecha, hoy)}. Prueba otro día.</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {datos.horas.map((h) => {
            const libre = libres(h), activo = valor === h.inicio;
            return (
              <button key={h.inicio} disabled={!libre} aria-pressed={activo} onClick={() => onElegir(h.inicio)}
                className={`titulo rounded-xl border-2 py-3 text-xl ${activo ? 'border-azul bg-azul text-white' : libre ? 'border-borde bg-carta' : 'border-transparent bg-carta/40 text-tenue/50 line-through'}`}>
                {hora12(h.hora)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Confirmar({ titulo, texto, si, onSi, onNo }: { titulo: string; texto: string; si: string; onSi: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-sm rounded-2xl border border-borde bg-carta p-5">
        <h2 className="titulo text-3xl">{titulo}</h2>
        <p className="mt-2 text-tenue">{texto}</p>
        <div className="mt-5 grid gap-2">
          <button className="btn btn-rojo" onClick={onSi}>{si}</button>
          <button className="btn btn-linea" onClick={onNo}>Volver</button>
        </div>
      </div>
    </div>
  );
}
