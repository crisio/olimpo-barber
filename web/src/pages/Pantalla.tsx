import { hora12, minutosEntre } from '../api';
import { Cargando, Logo, Poste, useDatos } from '../ui';

export default function Pantalla() {
  const { datos } = useDatos<any>('/pantalla', 15000);
  if (!datos) return <div className="p-8"><Logo grande /><Cargando /></div>;
  const enSilla = datos.citas.filter((c: any) => c.estado === 'en_atencion');
  const proximas = datos.citas.filter((c: any) => c.estado === 'agendada').slice(0, 8);
  return (
    <main className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="flex items-center justify-between"><Logo grande /><div className="titulo text-5xl md:text-7xl">{hora12(datos.ahora.slice(11))}</div></div>
      <Poste className="mt-5 !h-3" />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="titulo text-4xl text-tenue">En la silla</h2>
          {enSilla.length ? enSilla.map((c: any, i: number) => (
            <div key={i} className="mt-3 rounded-2xl bg-verde p-5 text-white"><div className="titulo text-6xl md:text-7xl">{c.nombre_publico}</div><div className="text-2xl">con {c.barbero}</div></div>
          )) : <div className="titulo mt-3 rounded-2xl border border-borde bg-carta p-5 text-5xl text-tenue">Silla libre</div>}
        </section>
        <section>
          <h2 className="titulo text-4xl text-tenue">Próximas citas</h2>
          <ul className="mt-3 grid gap-2">
            {proximas.map((c: any, i: number) => {
              const f = minutosEntre(datos.ahora, c.inicio);
              return (
                <li key={i} className={`flex items-center justify-between rounded-2xl border-2 p-4 ${f <= 0 ? 'border-rojo bg-rojo/15' : 'border-borde bg-carta'}`}>
                  <div><div className="titulo text-4xl md:text-5xl">{c.nombre_publico}</div><div className="text-lg text-tenue">con {c.barbero}</div></div>
                  <div className="titulo text-4xl md:text-5xl">{hora12(c.inicio.slice(11))}</div>
                </li>
              );
            })}
            {!proximas.length && <li className="titulo rounded-2xl border border-borde bg-carta p-5 text-4xl text-tenue">Sin más citas hoy</li>}
          </ul>
        </section>
      </div>
      <p className="mt-8 text-center text-xl text-tenue">Escanea el QR y agenda tu cita · sin descargar nada</p>
    </main>
  );
}
