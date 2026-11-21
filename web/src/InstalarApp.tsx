// Aviso para instalar la web como app (PWA). En Android usa el botón nativo de instalación;
// en iPhone y en navegadores sin ese botón muestra una guía paso a paso con una flecha que señala
// el botón del navegador. Dentro de Instagram, Facebook o TikTok pide abrir la página en el navegador.
import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { memoria } from './api';
import { urlArchivo, useMarca } from './marca';

type Plataforma = 'ios-safari' | 'ios-ipad' | 'ios-otro' | 'android' | 'app-interna' | 'escritorio';

const ua = () => navigator.userAgent;
export const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const esIPad = () => /iPad/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function plataforma(): Plataforma {
  if (/FBAN|FBAV|FB_IAB|Instagram|TikTok|BytedanceWebview|musical_ly|Snapchat|Line\//i.test(ua())) return 'app-interna';
  if (/iPhone|iPod/.test(ua()) || esIPad()) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua())) return 'ios-otro';
    return esIPad() ? 'ios-ipad' : 'ios-safari';
  }
  if (/Android/i.test(ua())) return 'android';
  return 'escritorio';
}

// Chrome y Edge avisan que la página se puede instalar; se guarda el aviso para mostrar el botón propio
let avisoNativo: any = null;
const oyentes = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); avisoNativo = e; oyentes.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { avisoNativo = null; memoria.guardar('ty_instalada', '1'); oyentes.forEach((f) => f()); });
}

const CLAVE_LUEGO = 'ty_instalar_luego';
const DIAS_SIN_MOLESTAR = 7;
const pospuesto = () => {
  const t = Number(memoria.leer(CLAVE_LUEGO) || 0);
  return Date.now() - t < DIAS_SIN_MOLESTAR * 864e5;
};
// Pantallas donde no se ofrece: la TV de la barbería, el aviso de privacidad y mientras se agenda
const SIN_AVISO = ['/pantalla', '/privacidad', '/agendar'];

export default function InstalarApp() {
  const marca = useMarca();
  const ruta = useLocation().pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '') || '/';
  const [visible, setVisible] = useState(false);
  const [guia, setGuia] = useState(false);
  const [nativo, setNativo] = useState<any>(avisoNativo);
  const [gracias, setGracias] = useState(false);
  const p = plataforma();

  useEffect(() => {
    const f = () => {
      setNativo(avisoNativo);
      if (memoria.leer('ty_instalada')) { setVisible(false); setGuia(false); setGracias(true); }
    };
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);

  useEffect(() => {
    if (instalada() || pospuesto() || SIN_AVISO.some((r) => ruta.startsWith(r))) { setVisible(false); return; }
    // En computadora solo si el navegador permite instalar; en el teléfono siempre
    if (p === 'escritorio' && !nativo) return;
    const t = setTimeout(() => setVisible(true), 3500);
    return () => clearTimeout(t);
  }, [ruta, nativo, p]);

  useEffect(() => {
    if (!gracias) return;
    const t = setTimeout(() => setGracias(false), 5000);
    return () => clearTimeout(t);
  }, [gracias]);

  const luego = () => { memoria.guardar(CLAVE_LUEGO, String(Date.now())); setVisible(false); setGuia(false); };
  async function instalar() {
    if (nativo) {
      nativo.prompt();
      const r = await nativo.userChoice.catch(() => null);
      avisoNativo = null; setNativo(null);
      if (r?.outcome === 'accepted') { setVisible(false); setGracias(true); } else luego();
      return;
    }
    setGuia(true);
  }

  const icono = urlArchivo(marca.logo_key) ?? `${import.meta.env.BASE_URL}icono-192.png`;
  return (
    <>
      {gracias && (
        <div className="no-imprimir fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]" role="status">
          <div className="mx-auto max-w-md rounded-2xl border border-verde bg-[#0f2a20] p-4 font-semibold shadow-2xl">
            ¡Listo! Ya tienes {marca.nombre} en tu pantalla de inicio.
          </div>
        </div>
      )}
      {visible && !guia && (
        <div className="aparecer no-imprimir fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <section className="mx-auto max-w-md rounded-2xl border border-borde bg-carta p-4 shadow-2xl" aria-label="Instalar la app">
            <div className="flex items-start gap-3">
              <img src={icono} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-fondo object-contain" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold leading-tight">Instala la app de {marca.nombre}</div>
                <div className="mt-0.5 text-sm text-tenue">Agenda en segundos y ten tu cita a un toque. Gratis, sin pasar por la tienda y casi no ocupa espacio.</div>
              </div>
              <button className="-mr-1 -mt-1 h-9 w-9 shrink-0 rounded-full text-2xl leading-none text-tenue" aria-label="Cerrar" onClick={luego}>×</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-linea !min-h-12 !text-lg" onClick={luego}>Ahora no</button>
              <button className="btn btn-rojo !min-h-12 !text-lg" onClick={instalar}>{p === 'app-interna' ? 'Cómo instalar' : 'Instalar'}</button>
            </div>
          </section>
        </div>
      )}
      {guia && <Guia plataforma={p} nombre={marca.nombre} icono={icono} onCerrar={() => setGuia(false)} onListo={luego} />}
    </>
  );
}

// ---------- Guía paso a paso ----------
const Icono = ({ d, className = 'h-7 w-7' }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const COMPARTIR = <><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" /></>;
const AGREGAR = <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></>;
const MENU = <><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></>;
const MAS = <><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></>;

/** Así se ve el botón o la opción que hay que tocar. */
function Muestra({ icono, texto, derecha }: { icono?: ReactNode; texto: string; derecha?: boolean }) {
  return (
    <div className={`mx-auto mt-4 flex w-full max-w-xs items-center gap-3 rounded-xl bg-white px-4 py-3 text-[#111] shadow-lg ${derecha ? 'justify-end' : ''}`}>
      {!derecha && icono && <span className="text-azul">{icono}</span>}
      <span className={`text-lg ${derecha ? 'font-semibold text-azul' : ''}`}>{texto}</span>
      {derecha && icono}
    </div>
  );
}

type Paso = { titulo: string; texto: ReactNode; muestra: ReactNode; flecha?: 'abajo' | 'arriba-derecha' };

function pasos(p: Plataforma, nombre: string): Paso[] {
  const agregar: Paso = {
    titulo: 'Elige «Agregar a inicio»',
    texto: <>Baja un poco en la lista si no lo ves. En algunos iPhone dice <b>«Añadir a pantalla de inicio»</b>.</>,
    muestra: <Muestra icono={<Icono d={AGREGAR} />} texto="Agregar a inicio" />,
  };
  const confirmar: Paso = {
    titulo: 'Toca «Agregar»',
    texto: <>Está arriba a la derecha. ¡Listo! El ícono de <b>{nombre}</b> queda en tu pantalla de inicio, como cualquier app.</>,
    muestra: <Muestra texto="Agregar" derecha />,
  };
  if (p === 'ios-safari') return [
    { titulo: 'Toca el botón Compartir', texto: <>Es el cuadrito con la flecha hacia arriba, <b>abajo en la barra de Safari</b>. Si no ves la barra, desliza la página un poco hacia abajo. Si solo ves <b>⋯</b>, tócalo y luego <b>Compartir</b>.</>, muestra: <Muestra icono={<Icono d={COMPARTIR} />} texto="Compartir" />, flecha: 'abajo' },
    agregar, confirmar,
  ];
  if (p === 'ios-ipad') return [
    { titulo: 'Toca el botón Compartir', texto: <>Es el cuadrito con la flecha hacia arriba, <b>arriba a la derecha</b> en Safari.</>, muestra: <Muestra icono={<Icono d={COMPARTIR} />} texto="Compartir" />, flecha: 'arriba-derecha' },
    agregar, confirmar,
  ];
  if (p === 'ios-otro') return [
    { titulo: 'Toca el botón Compartir', texto: <>En Chrome está <b>arriba, junto a la dirección</b>. En otros navegadores búscalo en el menú. Si no aparece la opción, abre esta página en <b>Safari</b>.</>, muestra: <Muestra icono={<Icono d={COMPARTIR} />} texto="Compartir" />, flecha: 'arriba-derecha' },
    agregar, confirmar,
  ];
  if (p === 'android') return [
    { titulo: 'Toca el menú ⋮', texto: <>Son los tres puntos <b>arriba a la derecha</b> del navegador.</>, muestra: <Muestra icono={<Icono d={MENU} />} texto="Menú" />, flecha: 'arriba-derecha' },
    { titulo: 'Elige «Instalar app»', texto: <>También puede decir <b>«Agregar a la pantalla principal»</b>.</>, muestra: <Muestra icono={<Icono d={AGREGAR} />} texto="Instalar app" /> },
    { titulo: 'Toca «Instalar»', texto: <>¡Listo! El ícono de <b>{nombre}</b> queda en tu pantalla de inicio.</>, muestra: <Muestra texto="Instalar" derecha /> },
  ];
  if (p === 'app-interna') return [
    { titulo: 'Ábrela en tu navegador', texto: <>Estás dentro de otra app (Instagram, Facebook o TikTok) y desde ahí no se puede instalar. Toca <b>⋯</b> arriba a la derecha y elige <b>«Abrir en el navegador»</b>. Luego toca otra vez <b>Instalar</b>.</>, muestra: <Muestra icono={<Icono d={MAS} />} texto="Abrir en el navegador" />, flecha: 'arriba-derecha' },
  ];
  return [
    { titulo: 'Instala desde el navegador', texto: <>Busca el ícono de instalar en la barra de direcciones o en el menú del navegador.</>, muestra: <Muestra icono={<Icono d={AGREGAR} />} texto="Instalar" /> },
  ];
}

function Guia({ plataforma: p, nombre, icono, onCerrar, onListo }: { plataforma: Plataforma; nombre: string; icono: string; onCerrar: () => void; onListo: () => void }) {
  const lista = pasos(p, nombre);
  const [i, setI] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const paso = lista[i];
  const ultimo = i === lista.length - 1;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);
  async function copiarEnlace() {
    try { await navigator.clipboard.writeText(location.href); setCopiado(true); } catch { setCopiado(false); }
  }
  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Cómo instalar la app">
      {paso.flecha === 'abajo' && (
        <div className="senalar-abajo pointer-events-none fixed bottom-1 left-1/2 -translate-x-1/2 text-6xl text-crema drop-shadow" aria-hidden="true">↓</div>
      )}
      {paso.flecha === 'arriba-derecha' && (
        <div className="senalar-arriba pointer-events-none fixed right-3 top-1 text-6xl text-crema drop-shadow" aria-hidden="true">↑</div>
      )}
      <div className="w-full max-w-sm rounded-3xl border border-borde bg-carta p-5 text-center">
        <img src={icono} alt="" className="mx-auto h-16 w-16 rounded-2xl bg-fondo object-contain" />
        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
          {lista.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all ${k === i ? 'w-8 bg-rojo' : 'w-2 bg-borde'}`} />)}
        </div>
        <div className="mt-3 text-sm uppercase tracking-widest text-tenue">{lista.length > 1 ? `Paso ${i + 1} de ${lista.length}` : 'Un paso'}</div>
        <h2 className="titulo mt-1 text-4xl" aria-live="polite">{paso.titulo}</h2>
        <p className="mt-2 text-base text-tenue">{paso.texto}</p>
        {paso.muestra}
        {p === 'app-interna' && (
          <button className="btn btn-linea mt-4 !min-h-12 !text-lg" onClick={copiarEnlace}>{copiado ? '✓ Enlace copiado' : 'Copiar el enlace'}</button>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {i > 0
            ? <button className="btn btn-linea !min-h-12 !text-lg" onClick={() => setI(i - 1)}>Atrás</button>
            : <button className="btn btn-linea !min-h-12 !text-lg" onClick={onCerrar}>Cerrar</button>}
          {ultimo
            ? <button className="btn btn-rojo !min-h-12 !text-lg" onClick={onListo}>Entendido</button>
            : <button className="btn btn-rojo !min-h-12 !text-lg" onClick={() => setI(i + 1)}>Siguiente</button>}
        </div>
      </div>
    </div>
  );
}
