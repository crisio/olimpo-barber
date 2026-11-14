import { useState } from 'react';
import { L, api, diaTexto, hora12, minutosEntre, sumarDias } from './api';
import { Aviso, Cargando, useDatos } from './ui';

const ETIQUETA: Record<string, string> = { agendada: 'Agendada', en_atencion: 'En la silla', terminada: 'Terminada', no_llego: 'No llegó' };

export default function Agenda({ rol }: { rol: 'barbero' | 'dueno' }) {
  const [fecha, setFecha] = useState<string | null>(null);
  const [barberoSel, setBarberoSel] = useState<number | null>(null);
  const ruta = `/agenda?${fecha ? `fecha=${fecha}&` : ''}${barberoSel ? `barbero=${barberoSel}` : ''}`;
  const { datos, error, recargar } = useDatos<any>(ruta, 15000);
  const [fallo, setFallo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  if (error && !datos) return <Aviso>{error.message}</Aviso>;
  if (!datos) return <Cargando />;
  const ahora: string = datos.ahora, hoy = ahora.slice(0, 10), dia: string = datos.fecha;
  const barbero: number = datos.barbero_id ?? datos.barberos.find((x: any) => x.activo)?.id;
  const citas = datos.citas.filter((c: any) => c.barbero_id === barbero);
  const tol = datos.barberia.tolerancia_min;
  const esHoy = dia === hoy;

  async function hacer(fn: () => Promise<unknown>) {
    setOcupado(true); setFallo('');
    try { await fn(); await recargar(); } catch (e: any) { setFallo(e.message); } finally { setOcupado(false); }
  }
  const accion = (id: number, a: string) => hacer(() => api(`/citas/${id}/accion`, { accion: a }));
  const bloquear = (inicio: string, quitar = false) => hacer(() => api('/bloqueos', { barbero_id: barbero, inicio, quitar }));

  const enCurso = citas.find((c: any) => c.estado === 'en_atencion');
  const siguiente = citas.find((c: any) => c.estado === 'agendada');
  const faltanSig = siguiente ? minutosEntre(ahora, siguiente.inicio) : 0;
  const tolVencida = siguiente && faltanSig + tol <= 0;
  const bloqueadas = new Set(datos.bloqueos.filter((x: any) => x.barbero_id === barbero).map((x: any) => x.inicio));
  const futuras = datos.horas.filter((h: any) => h.inicio > ahora);
  const proxLibre = futuras.find((h: any) => h.barberos.includes(barbero));
  const proxBloq = futuras.find((h: any) => bloqueadas.has(h.inicio));
  const enPausa = proxBloq && (!proxLibre || proxBloq.inicio < proxLibre.inicio);
  const waTexto = (c: any) => `https://wa.me/${c.telefono}?text=${encodeURIComponent(`${c.nombre.split(' ')[0]}, te esperamos en ${datos.barberia.nombre} a las ${hora12(c.inicio.slice(11))}. Llega puntual: hay ${tol} min de tolerancia.`)}`;

  const inicios = [...new Set<string>([...datos.horas.map((h: any) => h.inicio), ...citas.map((c: any) => c.inicio), ...bloqueadas as Set<string>])].sort()
    // Las horas pasadas sin cita no se muestran
    .filter((ini) => ini.slice(0, 13) >= ahora.slice(0, 13) || citas.some((c: any) => c.inicio === ini));

  return (
    <div>
      {rol === 'dueno' && datos.barberos.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {datos.barberos.filter((x: any) => x.activo).map((x: any) => (
            <button key={x.id} aria-pressed={x.id === barbero} onClick={() => setBarberoSel(x.id)}
              className={`titulo shrink-0 rounded-xl border-2 px-4 py-2 text-xl ${x.id === barbero ? 'border-crema bg-crema text-fondo' : 'border-borde'}`}>{x.apodo || x.nombre}</button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button className="btn btn-linea !min-h-12 !w-14 !text-2xl" aria-label="Día anterior" onClick={() => setFecha(sumarDias(dia, -1))}>‹</button>
        <button className="titulo text-3xl" onClick={() => setFecha(null)}>{diaTexto(dia, hoy)}</button>
        <button className="btn btn-linea !min-h-12 !w-14 !text-2xl" aria-label="Día siguiente" onClick={() => setFecha(sumarDias(dia, 1))}>›</button>
      </div>
      {fallo && <div className="mt-3"><Aviso>{fallo}</Aviso></div>}

      {esHoy && (<>
        <div className={`mt-3 rounded-2xl border-2 p-4 ${enCurso ? 'border-verde bg-verde/15' : 'border-borde bg-carta'}`}>
          <div className="text-sm uppercase tracking-widest text-tenue">Ahora en la silla</div>
          {enCurso ? (<>
            <div className="titulo text-5xl">{enCurso.nombre}</div>
            <div className="text-lg">{enCurso.servicios.map((s: any) => s.nombre).join(' + ')} · <b>{L(enCurso.total_l)}</b>{enCurso.recargo_l ? ` (incluye recargo ${L(enCurso.recargo_l)})` : ''}</div>
          </>) : <div className="titulo text-4xl text-tenue">Silla libre</div>}
        </div>
        <div className={`mt-2 rounded-2xl border-2 p-4 ${tolVencida ? 'border-rojo bg-rojo/15' : 'border-borde bg-carta'}`}>
          <div className="text-sm uppercase tracking-widest text-tenue">Siguiente cita</div>
          {siguiente ? (<>
            <div className="flex items-baseline justify-between gap-2">
              <div className="titulo min-w-0 truncate text-4xl">{siguiente.nombre}</div><div className="titulo shrink-0 whitespace-nowrap text-3xl">{hora12(siguiente.inicio.slice(11))}</div>
            </div>
            <div className="text-lg">{siguiente.servicios.map((s: any) => s.nombre).join(' + ')} · <b>{L(siguiente.total_l)}</b></div>
            <div className="mt-1 font-semibold">
              {faltanSig > 0 ? `Llega en ${faltanSig} min` : tolVencida ? `Tolerancia vencida hace ${-(faltanSig + tol)} min` : `En tolerancia: quedan ${faltanSig + tol} min`}
              {siguiente.no_llegadas > 0 && <span className="text-rojo"> · ha faltado {siguiente.no_llegadas} {siguiente.no_llegadas === 1 ? 'vez' : 'veces'}</span>}
            </div>
            {siguiente.telefono && <a className="btn btn-linea mt-3 !min-h-12 !text-lg" href={waTexto(siguiente)} target="_blank" rel="noreferrer">Avisarle por WhatsApp</a>}
          </>) : <div className="titulo text-3xl text-tenue">No hay más citas hoy</div>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn btn-verde !min-h-24 !text-3xl" disabled={ocupado || !siguiente || !!enCurso} onClick={() => accion(siguiente.id, 'llego')}>Llegó</button>
          <button className="btn btn-azul !min-h-24 !text-3xl" disabled={ocupado || !enCurso} onClick={() => accion(enCurso.id, 'termine')}>Terminé</button>
          <button className="btn btn-rojo !min-h-24 !text-3xl" disabled={ocupado || !tolVencida} onClick={() => accion(siguiente.id, 'no_llego')}>No llegó</button>
          {enPausa
            ? <button className="btn btn-crema !min-h-24 flex-col !gap-0 !text-3xl" disabled={ocupado} onClick={() => bloquear(proxBloq.inicio, true)}>Volver<span className="whitespace-nowrap text-base">({hora12(proxBloq.hora)})</span></button>
            : <button className="btn btn-crema !min-h-24 flex-col !gap-0 !text-3xl" disabled={ocupado || !proxLibre} onClick={() => bloquear(proxLibre.inicio)}>Pausa{proxLibre && <span className="whitespace-nowrap text-base">({hora12(proxLibre.hora)})</span>}</button>}
        </div>
        {siguiente && !tolVencida && <p className="mt-2 text-center text-sm text-tenue">“No llegó” se activa {tol} min después de la hora de la cita.</p>}
        <p className="mt-1 text-center text-sm text-tenue">¿Llegó otro cliente antes? Toca “Atender ahora” en su cita de la lista. Confirma con su código.</p>
      </>)}

      <h2 className="titulo mt-6 text-3xl">Agenda del día</h2>
      {!inicios.length && <p className="mt-2 text-tenue">Sin horario este día.</p>}
      <ul className="mt-2 grid gap-2">
        {inicios.map((ini) => {
          const cs = citas.filter((c: any) => c.inicio === ini);
          const viva = cs.find((c: any) => c.estado !== 'no_llego');
          const libre = !viva && ini > ahora && !bloqueadas.has(ini) && datos.horas.some((h: any) => h.inicio === ini && h.barberos.includes(barbero));
          return (
            <li key={ini} className="rounded-xl border border-borde bg-carta p-3">
              <div className="flex items-start gap-3">
                <div className="titulo w-24 shrink-0 text-2xl">{hora12(ini.slice(11))}</div>
                <div className="min-w-0 flex-1">
                  {cs.map((c: any) => (
                    <div key={c.id} className={c.estado === 'no_llego' ? 'text-tenue' : ''}>
                      <div className="font-semibold">{c.nombre} <span className="text-sm font-normal text-tenue">· {c.codigo} · {ETIQUETA[c.estado]}{c.origen === 'manual' ? ' · a mano' : ''}</span></div>
                      <div className="text-sm text-tenue">{c.servicios.map((s: any) => s.nombre).join(' + ')} · {L(c.total_l)}{c.telefono ? ` · +${c.telefono}` : ''}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-sm">
                        {c.estado === 'agendada' && esHoy && !enCurso && <button className="font-semibold underline" disabled={ocupado} onClick={() => accion(c.id, 'llego')}>Atender ahora</button>}
                        {c.estado === 'agendada' && <button className="underline" disabled={ocupado} onClick={() => accion(c.id, 'cancelar')}>Cancelar</button>}
                        {c.estado === 'en_atencion' || (c.estado === 'no_llego' && !viva) ? <button className="underline" disabled={ocupado} onClick={() => accion(c.id, 'deshacer')}>Deshacer</button> : null}
                        {c.telefono && c.estado === 'agendada' && <a className="underline" href={waTexto(c)} target="_blank" rel="noreferrer">WhatsApp</a>}
                      </div>
                    </div>
                  ))}
                  {!cs.length && bloqueadas.has(ini) && <div className="text-tenue">Bloqueada (pausa) · <button className="underline" disabled={ocupado} onClick={() => bloquear(ini, true)}>Quitar</button></div>}
                  {libre && <div className="flex gap-4 text-sm"><span className="text-tenue">Libre</span>
                    <button className="font-semibold underline" onClick={() => setManual(ini)}>+ Agregar cliente</button>
                    <button className="underline" disabled={ocupado} onClick={() => bloquear(ini)}>Bloquear</button></div>}
                  {!cs.length && !libre && !bloqueadas.has(ini) && <div className="text-tenue/60">—</div>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {manual && <Manual inicio={manual} barbero={barbero} servicios={datos.servicios.filter((s: any) => s.activo)} onCerrar={(ok) => { setManual(null); if (ok) recargar(); }} />}
    </div>
  );
}

function Manual({ inicio, barbero, servicios, onCerrar }: { inicio: string; barbero: number; servicios: any[]; onCerrar: (ok: boolean) => void }) {
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [sel, setSel] = useState<number[]>(servicios[0] ? [servicios[0].id] : []);
  const [fallo, setFallo] = useState('');
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try { await api('/agenda/manual', { nombre, telefono: tel || undefined, servicios: sel, inicio, barbero_id: barbero }); onCerrar(true); }
    catch (x: any) { setFallo(x.message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Agregar cliente">
      <form onSubmit={guardar} className="w-full max-w-sm rounded-2xl border border-borde bg-carta p-5">
        <h2 className="titulo text-3xl">Agregar a las {hora12(inicio.slice(11))}</h2>
        {fallo && <div className="mt-2"><Aviso>{fallo}</Aviso></div>}
        <label className="mt-3 block text-sm text-tenue" htmlFor="m-nombre">Nombre</label>
        <input id="m-nombre" className="campo mt-1" value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <label className="mt-3 block text-sm text-tenue" htmlFor="m-tel">WhatsApp (opcional)</label>
        <input id="m-tel" className="campo mt-1" inputMode="numeric" value={tel} maxLength={9} onChange={(e) => setTel(e.target.value.replace(/[^\d-]/g, ''))} placeholder="9999-9999" />
        <div className="mt-3 flex flex-wrap gap-2">
          {servicios.map((s) => {
            const on = sel.includes(s.id);
            return <button type="button" key={s.id} aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== s.id) : [...sel, s.id])}
              className={`rounded-xl border-2 px-3 py-2 ${on ? 'border-azul bg-azul/20' : 'border-borde'}`}>{s.nombre} {L(s.precio_l)}</button>;
          })}
        </div>
        <button className="btn btn-rojo mt-4" disabled={nombre.trim().length < 2 || !sel.length}>Guardar cita</button>
        <button type="button" className="btn btn-linea mt-2" onClick={() => onCerrar(false)}>Cerrar</button>
      </form>
    </div>
  );
}
