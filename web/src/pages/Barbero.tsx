import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, token } from '../api';
import Agenda from '../Agenda';
import { Aviso, Cargando, Logo, Pagina, useDatos } from '../ui';

export default function Barbero() {
  const [dentro, setDentro] = useState(!!token.leer());
  const { datos: yo, error } = useDatos<any>(dentro ? '/auth/yo' : null);
  if (dentro && error?.estado === 401) { token.guardar(null); setDentro(false); }
  if (!dentro) return <Entrar onListo={() => setDentro(true)} />;
  return (
    <Pagina>
      <div className="flex items-center justify-between">
        <Logo />
        <button className="text-sm text-tenue underline" onClick={async () => { await api('/auth/salir', {}).catch(() => {}); token.guardar(null); setDentro(false); }}>Salir</button>
      </div>
      <div className="mt-4">{yo ? <Agenda rol={yo.rol} /> : <Cargando />}</div>
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
    const p = (pin + d).slice(0, 6);
    setPin(p);
    if (p.length === 4) probar(p);
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
          <div className="mt-4 flex justify-center gap-3" aria-label={`${pin.length} de 4 dígitos`}>
            {[0, 1, 2, 3].map((i) => <div key={i} className={`h-5 w-5 rounded-full border-2 border-crema ${i < pin.length ? 'bg-crema' : ''}`} />)}
          </div>
          {fallo && <div className="mt-4"><Aviso>{fallo}</Aviso></div>}
          <div className="mt-5 grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="btn btn-linea !min-h-20 !text-4xl" onClick={() => tecla(d)}>{d}</button>)}
            <button className="btn btn-linea !min-h-20 !text-lg" onClick={() => { setQuien(null); setPin(''); setFallo(''); }}>Atrás</button>
            <button className="btn btn-linea !min-h-20 !text-4xl" onClick={() => tecla('0')}>0</button>
            <button className="btn btn-linea !min-h-20 !text-lg" onClick={() => setPin(pin.slice(0, -1))}>Borrar</button>
          </div>
          <p className="mt-4 text-center text-sm text-tenue">¿No tienes PIN? Pídeselo al dueño.</p>
        </div>
      )}
    </Pagina>
  );
}
