// Pagar por transferencia: el cliente copia el número de cuenta, abre la app de su banco y pega.
import { useEffect, useState } from 'react';
import { L } from './api';
import { subirComprobante } from './imagen';
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

/**
 * `codigo`: estamos en la pantalla de una cita (se puede subir el comprobante si la API lo permite).
 * `puedeSubir`: la API publicada recibe comprobantes. `conComprobante`: ya hay uno enviado.
 */
export default function Transferencia({ b, total, codigo, detalle, puedeSubir = false, conComprobante = false, onSubido }: {
  b: any; total?: number; codigo?: string; detalle?: string; puedeSubir?: boolean; conComprobante?: boolean; onSubido?: () => void;
}) {
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
                  {copiada === c.id ? '✓ Copiado' : 'Copiar'}
                </button>
                {app && <a className="btn btn-linea !min-h-14 !text-xl" href={app} target="_blank" rel="noopener noreferrer" aria-label={`Abrir la app de ${banco.nombre}`}>Abrir app</a>}
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn btn-azul mt-3" onClick={() => setElegir(true)}>Abrir la app de mi banco</button>
      {codigo && puedeSubir
        ? <YaPague codigo={codigo} wa={wa} enviado={conComprobante} onSubido={onSubido} />
        : (wa || codigo) && (
          <div className="mt-4 rounded-2xl border border-borde bg-carta p-4">
            <h3 className="titulo text-2xl">¿Ya pagaste?</h3>
            {wa && <a className="btn btn-verde mt-3" href={wa} target="_blank" rel="noopener noreferrer">Enviar captura por WhatsApp</a>}
            {!codigo && <p className="mt-2 text-sm text-tenue">Si ya agendaste, también puedes subir la captura desde la pantalla de tu cita.</p>}
            {codigo && !wa && <p className="mt-1 text-sm text-tenue">Muéstrale la captura de la transferencia a tu barbero cuando llegues.</p>}
          </div>
        )}
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

/** Después de transferir: subir la captura aquí (le llega al barbero) o mandarla por WhatsApp. */
function YaPague({ codigo, wa, enviado, onSubido }: { codigo: string; wa: string | false; enviado: boolean; onSubido?: () => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [msj, setMsj] = useState<{ ok: boolean; texto: string } | null>(null);
  async function subir(f: File) {
    setSubiendo(true); setMsj(null);
    try {
      await subirComprobante(codigo, f);
      setMsj({ ok: true, texto: '¡Listo! Tu barbero ya puede ver la captura de tu pago.' });
      onSubido?.();
    } catch (e: any) {
      setMsj({ ok: false, texto: e?.message ?? 'No se pudo enviar la captura.' });
    } finally { setSubiendo(false); }
  }
  return (
    <div className={`mt-4 rounded-2xl border-2 p-4 ${enviado ? 'border-verde bg-verde/10' : 'border-borde bg-carta'}`}>
      <h3 className="titulo text-2xl">{enviado ? '✓ Comprobante enviado' : '¿Ya pagaste?'}</h3>
      <p className="mt-1 text-tenue">{enviado ? 'Tu barbero ya lo puede ver. Si te equivocaste de captura, súbela otra vez.' : 'Sube la captura de la transferencia y le llega a tu barbero.'}</p>
      {msj && <p className={`mt-3 rounded-xl border px-4 py-3 font-semibold ${msj.ok ? 'border-verde/60 bg-verde/15' : 'border-rojo/60 bg-rojo/15'}`} role="status">{msj.texto}</p>}
      <label className={`btn mt-3 cursor-pointer ${enviado ? 'btn-linea' : 'btn-rojo'} ${subiendo ? 'pointer-events-none opacity-50' : ''}`}>
        {subiendo ? 'Enviando…' : enviado ? 'Cambiar captura' : 'Subir captura del pago'}
        <input type="file" accept="image/*" className="sr-only" disabled={subiendo}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }} />
      </label>
      {wa && <a className="btn btn-linea mt-2 !text-lg" href={wa} target="_blank" rel="noopener noreferrer">O enviarla por WhatsApp</a>}
    </div>
  );
}
