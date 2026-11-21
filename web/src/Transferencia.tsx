// Pagar por transferencia: el cliente copia el número de cuenta, abre la app de su banco y pega.
import { useEffect, useState } from 'react';
import { L } from './api';
import { BANCOS, Banco, Cuenta, MONEDAS, TIPOS, bancoDe, copiar, cuentasDe, enlaceApp, iniciales, urlLogoBanco } from './bancos';

export function SelloBanco({ banco, tam = 'h-12 w-12 text-lg' }: { banco: Banco; tam?: string }) {
  const logo = urlLogoBanco(banco);
  if (logo) return <img src={logo} alt="" className={`${tam} shrink-0 rounded-xl object-cover`} />;
  return (
    <span className={`${tam} titulo flex shrink-0 items-center justify-center rounded-xl text-white`} style={{ background: banco.color }} aria-hidden="true">
      {iniciales(banco)}
    </span>
  );
}

/** Número sin espacios ni guiones, como lo piden las apps de los bancos. */
const paraPegar = (n: string) => n.replace(/[\s-]/g, '');

export default function Transferencia({ b, total, codigo, detalle }: { b: any; total?: number; codigo?: string; detalle?: string }) {
  const cuentas = cuentasDe(b);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [elegir, setElegir] = useState(false);
  useEffect(() => {
    if (!copiada) return;
    const t = setTimeout(() => setCopiada(null), 4000);
    return () => clearTimeout(t);
  }, [copiada]);
  if (!cuentas.length) return null;

  async function copiarCuenta(c: Cuenta) {
    const ok = await copiar(paraPegar(c.numero));
    setCopiada(ok ? c.id : null);
    setAviso(ok ? 'Número copiado. Ahora abre la app de tu banco y pégalo en la transferencia.' : `No se pudo copiar. El número es ${c.numero}.`);
  }
  const mensaje = codigo
    ? `Hola, hice una transferencia${total ? ` de ${L(total)}` : ''} para mi cita ${codigo}${detalle ? ` (${detalle})` : ''}. Aquí va el comprobante.`
    : `Hola, hice una transferencia a ${b.nombre}. Aquí va el comprobante.`;
  const wa = b.whatsapp_numero && `https://wa.me/${b.whatsapp_numero}?text=${encodeURIComponent(mensaje)}`;
  return (
    <section className="mt-8" aria-labelledby="titulo-transferencia">
      <h2 id="titulo-transferencia" className="titulo text-3xl">Pagar por transferencia</h2>
      <p className="mt-1 text-tenue">
        {total ? <>Total: <b className="text-crema">{L(total)}</b>. </> : null}
        Copia el número, abre la app de tu banco y pégalo.
      </p>
      {aviso && <p className="mt-3 rounded-xl border border-verde/60 bg-verde/15 px-4 py-3 font-semibold" role="status">{aviso}</p>}
      <div className="mt-3 grid gap-3">
        {cuentas.map((c) => {
          const banco = bancoDe(c.banco, c.banco_nombre);
          const app = enlaceApp(banco);
          return (
            <div key={c.id} className="rounded-2xl border border-borde bg-carta p-4">
              <div className="flex items-center gap-3">
                <SelloBanco banco={banco} />
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{banco.nombre}</div>
                  <div className="text-sm text-tenue">{TIPOS[c.tipo] ?? 'Cuenta'} · {MONEDAS[c.moneda] ?? 'Lempiras'}</div>
                </div>
              </div>
              <div className="titulo mt-3 break-all text-4xl tracking-wider tabular-nums">{c.numero}</div>
              {c.titular && <div className="text-tenue">A nombre de <b className="text-crema">{c.titular}</b></div>}
              {c.nota && <div className="mt-1 text-sm text-tenue">{c.nota}</div>}
              <div className={`mt-3 grid gap-2 ${app ? 'grid-cols-2' : ''}`}>
                <button className={`btn !min-h-14 !text-xl ${copiada === c.id ? 'btn-verde' : 'btn-rojo'}`} onClick={() => copiarCuenta(c)} aria-label={`Copiar número de cuenta de ${banco.nombre}`}>
                  {copiada === c.id ? '✓ Copiado' : 'Copiar número'}
                </button>
                {app && <a className="btn btn-linea !min-h-14 !text-xl" href={app} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la app de ${banco.nombre}`}>Abrir app</a>}
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-azul mt-3" onClick={() => setElegir(true)}>Abrir la app de mi banco</button>
      {wa && <a className="btn btn-verde mt-2" href={wa} target="_blank" rel="noopener noreferrer">Enviar comprobante</a>}
      {elegir && <ElegirBanco primero={cuentas.map((c) => c.banco)} onCerrar={() => setElegir(false)} />}
    </section>
  );
}

/** Lista de bancos para que el cliente abra el suyo (puede ser distinto al de la barbería). */
function ElegirBanco({ primero, onCerrar }: { primero: string[]; onCerrar: () => void }) {
  const lista = [...BANCOS].filter((b) => enlaceApp(b)).sort((a, b) => Number(primero.includes(b.clave)) - Number(primero.includes(a.clave)));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-modal="true" aria-label="¿Cuál es tu banco?" onClick={onCerrar}>
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-borde bg-carta p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo text-3xl">¿Cuál es tu banco?</h2>
        <p className="mt-1 text-sm text-tenue">Te lleva a la app en la tienda del teléfono. Si ya la tienes, toca <b className="text-crema">Abrir</b> y pega el número.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {lista.map((b) => (
            <a key={b.clave} href={enlaceApp(b)!} target="_blank" rel="noopener noreferrer" className="flex min-h-16 items-center gap-2 rounded-xl border-2 border-borde bg-fondo px-3 py-2 active:bg-borde/40">
              <SelloBanco banco={b} tam="h-9 w-9 text-sm" />
              <span className="min-w-0 text-base font-semibold leading-tight">{b.corto}</span>
            </a>
          ))}
        </div>
        <button className="btn btn-linea mt-4" onClick={onCerrar}>Cerrar</button>
      </div>
    </div>
  );
}
