// Registro de uso: anota cada toque en botones y enlaces y lo envía en lotes a la API.
// Se identifica por la sesión si la hay y, si no, por un identificador anónimo del navegador
// (una página web no puede leer la dirección MAC del equipo).
import { API, DEMO, dispositivo, token } from './api';

type Evento = { ruta: string; elemento: string; t: number };
const cola: Evento[] = [];

/** Quita de la ruta los códigos de cita para no guardarlos. */
const rutaActual = () => location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '').replace(/^\/c\/[^/]+/, '/c/:codigo') || '/';

function etiqueta(el: Element) {
  const t = el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || (el as HTMLInputElement).name || el.tagName.toLowerCase();
  return t.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function enviar() {
  if (!cola.length) return;
  const ahora = Date.now(), lote = cola.splice(0, 40);
  const t = token.leer();
  fetch(`${API}/api/eventos`, {
    method: 'POST', keepalive: true,
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ dispositivo: dispositivo(), eventos: lote.map((e) => ({ ruta: e.ruta, elemento: e.elemento, hace_ms: ahora - e.t })) }),
  }).catch(() => { /* el registro nunca debe estorbar el uso */ });
}

export function iniciarRegistro() {
  if (DEMO) return;
  document.addEventListener('click', (ev) => {
    const el = (ev.target as Element | null)?.closest?.('button, a, [role="button"], [role="tab"], input[type="checkbox"], input[type="file"], label');
    // Nunca se registra lo que se toca dentro de zonas marcadas (teclado del PIN)
    if (!el || el.closest('[data-sin-registro]')) return;
    cola.push({ ruta: rutaActual(), elemento: etiqueta(el), t: Date.now() });
    if (cola.length >= 20) enviar();
  }, { capture: true, passive: true });
  setInterval(enviar, 8000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) enviar(); });
  window.addEventListener('pagehide', enviar);
}
