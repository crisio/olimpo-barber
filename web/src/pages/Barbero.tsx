import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEMO, api, token } from '../api';
import Agenda from '../Agenda';
import CompartirQR from '../CompartirQR';
import { Aviso, Cargando, Logo, Pagina, useDatos } from '../ui';

export default function Barbero() {
  const [dentro, setDentro] = useState(!!token.leer());
  const { datos: yo, error } = useDatos<any>(dentro ? '/auth/yo' : null);
  const { datos: cfg } = useDatos<any>('/barberia');
  const [vista, setVista] = useState<'agenda' | 'qr'>('agenda');
  if (dentro && error?.estado === 401) { token.guardar(null); setDentro(false); }
  if (!dentro) return <Entrar onListo={() => setDentro(true)} />;
  return (
    <Pagina>
      <div className="flex items-center justify-between">
        <Logo />
        <button className="text-sm text-tenue underline" onClick={async () => { await api('/auth/salir', {}).catch(() => {}); token.guardar(null); setDentro(false); }}>Salir</button>
      </div>
      {yo && (
        <div className="mt-4 flex gap-2">
          <button aria-pressed={vista === 'agenda'} onClick={() => setVista('agenda')} className={`titulo flex-1 rounded-xl border-2 py-2 text-xl ${vista === 'agenda' ? 'border-crema bg-crema text-fondo' : 'border-borde'}`}>Agenda</button>
          <button aria-pressed={vista === 'qr'} onClick={() => setVista('qr')} className={`titulo flex-1 rounded-xl border-2 py-2 text-xl ${vista === 'qr' ? 'border-crema bg-crema text-fondo' : 'border-borde'}`}>Mi QR</button>
          {yo.rol === 'dueno' && <Link to="/dueno" className="titulo flex-1 rounded-xl border-2 border-azul bg-azul py-2 text-center text-xl text-white">Panel</Link>}
        </div>
      )}
      <div className="mt-4">
        {!yo ? <Cargando /> : vista === 'agenda' ? <Agenda rol={yo.rol} />
          : <CompartirQR barberoId={yo.barbero_id} barberoNombre={cfg?.barberos.find((b: any) => b.id === yo.barbero_id)?.nombre} />}
      </div>
    </Pagina>
  );
}

function Entrar({ onListo }: { onListo: () => void }) {
  const { datos } = useDatos<any>('/barberia');
  const [quien, setQuien] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [fallo, setFallo] = useState('');
  async function probar(p: string) {
    try { const r = await api('/auth/pin', { barbero_id: quien.id, pin: p }); token.guardar(r.token); onListo(); }
    catch (e: any) { setFallo(e.message); setPin(''); }
  }
  function tecla(d: string) {
    setFallo('');
    const largo = quien.pin_digitos ?? 4;
    const p = (pin + d).slice(0, largo);
    setPin(p);
    if (p.length === largo) probar(p);
  }
  return (
    <Pagina>
      <Logo />
      {!datos ? <Cargando /> : !quien ? (
        <div className="mt-6">
          <h1 className="titulo text-5xl">¿Quién eres?</h1>
          <div className="mt-4 grid gap-3">
            {datos.barberos.map((b: any) => (
              <button key={b.id} className="btn btn-linea !min-h-20 !text-3xl" onClick={() => setQuien(b)}>{b.nombre}</button>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-tenue"><Link className="underline" to="/dueno">Soy el dueño</Link> · <Link className="underline" to="/">Inicio</Link></p>
        </div>
      ) : (
        <div className="mt-6">
          <h1 className="titulo text-5xl">PIN de {quien.apodo || quien.nombre}</h1>
          <div className="mt-4 flex justify-center gap-3" aria-label={`${pin.length} de ${quien.pin_digitos ?? 4} dígitos`}>
            {Array.from({ length: quien.pin_digitos ?? 4 }, (_, i) => i).map((i) => <div key={i} className={`h-5 w-5 rounded-full border-2 border-crema ${i < pin.length ? 'bg-crema' : ''}`} />)}
          </div>
          {fallo && <div className="mt-4"><Aviso>{fallo}</Aviso></div>}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="btn btn-linea !min-h-20 !text-4xl" onClick={() => tecla(d)}>{d}</button>)}
            <button className="btn btn-linea !min-h-20 !text-lg" onClick={() => { setQuien(null); setPin(''); setFallo(''); }}>Atrás</button>
            <button className="btn btn-linea !min-h-20 !text-4xl" onClick={() => tecla('0')}>0</button>
            <button className="btn btn-linea !min-h-20 !text-lg" onClick={() => setPin(pin.slice(0, -1))}>Borrar</button>
          </div>
          <p className="mt-4 text-center text-sm text-tenue">{DEMO ? 'En la demostración el PIN es 1111.' : '¿No tienes PIN? Pídeselo al dueño.'}</p>
        </div>
      )}
    </Pagina>
  );
}
