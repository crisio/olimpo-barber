import { useEffect, useState } from 'react';
import { DEMO, api } from './api';

type Estado = 'cargando' | 'no_soportado' | 'instalar_ios' | 'apagadas' | 'bloqueadas' | 'activas';

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const registro = async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistration()) ?? null : null);

/** Tarjeta para que el personal active los avisos de citas nuevas en su celular. */
export default function Notificaciones() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [msj, setMsj] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (DEMO) return setEstado('no_soportado');
      if (esIOS() && !instalada()) return setEstado('instalar_ios');
      const reg = await registro();
      if (!reg || !('PushManager' in window) || !('Notification' in window)) return setEstado('no_soportado');
      if (Notification.permission === 'denied') return setEstado('bloqueadas');
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // Se vuelve a guardar para que quede a nombre de quien tiene la sesión abierta
        await api('/push/suscribir', sub.toJSON()).catch(() => {});
        return setEstado('activas');
      }
      setEstado('apagadas');
    })().catch(() => setEstado('no_soportado'));
  }, []);

  async function activar() {
    setOcupado(true); setMsj('');
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { setEstado(permiso === 'denied' ? 'bloqueadas' : 'apagadas'); return; }
      const reg = (await registro())!;
      const { clave } = await api('/push/clave');
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }));
      await api('/push/suscribir', sub.toJSON());
      setEstado('activas');
      await api('/push/prueba', { endpoint: sub.endpoint });
      setMsj('Listo. Te acaba de llegar una notificación de prueba.');
    } catch (e: any) { setMsj(e?.message || 'No se pudo activar en este dispositivo.'); }
    finally { setOcupado(false); }
  }
  async function probar() {
    setOcupado(true); setMsj('');
    try {
      const sub = await (await registro())!.pushManager.getSubscription();
      await api('/push/prueba', { endpoint: sub!.endpoint });
      setMsj('Enviada. Debe llegarte en unos segundos.');
    } catch (e: any) { setMsj(e?.message || 'No se pudo enviar la prueba.'); }
    finally { setOcupado(false); }
  }

  if (estado === 'cargando' || estado === 'no_soportado') return null;
  if (estado === 'activas') return (
    <p className="mb-3 flex flex-wrap items-center gap-x-3 text-sm text-tenue" role="status">
      <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-verde" aria-hidden="true" />Avisos de citas activos en este celular.</span>
      <button className="underline" disabled={ocupado} onClick={probar}>Enviar prueba</button>
      {msj && <span className="w-full text-crema">{msj}</span>}
    </p>
  );
  return (
    <section className="mb-4 rounded-2xl border-2 border-azul bg-azul/15 p-4">
      <h2 className="titulo text-2xl">Avisos de citas nuevas</h2>
      {estado === 'instalar_ios' && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-base">
          <li>Abre esta página en Safari y toca el botón <b>Compartir</b>.</li>
          <li>Elige <b>Añadir a pantalla de inicio</b>.</li>
          <li>Abre la app desde el icono nuevo y vuelve aquí para activar los avisos.</li>
        </ol>
      )}
      {estado === 'bloqueadas' && <p className="mt-2">Las notificaciones están bloqueadas para este sitio. Actívalas en los ajustes del navegador y recarga la página.</p>}
      {estado === 'apagadas' && (<>
        <p className="mt-1 text-tenue">Recibe una notificación en este celular cada vez que alguien reserva, cancela o cambia su cita.</p>
        <button className="btn btn-azul mt-3" disabled={ocupado} onClick={activar}>{ocupado ? 'Activando…' : 'Activar notificaciones'}</button>
      </>)}
      {msj && <p className="mt-2 font-semibold" role="status">{msj}</p>}
    </section>
  );
}
