// Fotos y logo: se achican en el mismo teléfono antes de subirlos, así una foto de la cámara
// (3 a 8 MB) queda en unos cientos de KB y sube rápido aunque la señal sea mala.
import { API, DEMO, ErrorApi, api, token } from './api';

async function reducir(archivo: File, max: number, tipo: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch { throw new Error('No se pudo abrir esa imagen. Prueba con una foto JPG o PNG.'); }
    const ancho = img.naturalWidth || 512, alto = img.naturalHeight || 512;
    const escala = Math.min(1, max / Math.max(ancho, alto));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(ancho * escala));
    c.height = Math.max(1, Math.round(alto * escala));
    const x = c.getContext('2d')!;
    if (tipo === 'image/jpeg') { x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); }
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, tipo, 0.88));
    if (!blob) throw new Error('No se pudo procesar la imagen.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const aDataUrl = (b: Blob) => new Promise<string>((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result)); r.onerror = () => mal(r.error);
  r.readAsDataURL(b);
});

/** Sube el logo (sin barbero) o la foto de un barbero. Devuelve la clave guardada. */
export async function subirImagen(archivo: File, barbero?: number | null): Promise<string> {
  // El logo se guarda en PNG para respetar el fondo transparente; las fotos en JPG
  const blob = barbero ? await reducir(archivo, 600, 'image/jpeg') : await reducir(archivo, 720, 'image/png');
  if (DEMO) return (await api('/archivos', { imagen: await aDataUrl(blob), barbero: barbero ?? null })).clave;
  let r: Response;
  try {
    r = await fetch(`${API}/api/archivos${barbero ? `?barbero=${barbero}` : ''}`, {
      method: 'POST', headers: { 'content-type': blob.type, authorization: `Bearer ${token.leer()}` }, body: blob,
    });
  } catch { throw new ErrorApi('Sin conexión. Revisa tu internet.', 0, null); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(d?.error ?? 'No se pudo subir la imagen.', r.status, d);
  return d.clave;
}

/** Quita el logo (vuelve el emblema original) o la foto de un barbero. */
export const quitarImagen = (barbero?: number | null) => api(`/archivos${barbero ? `?barbero=${barbero}` : ''}`, undefined, 'DELETE');

/**
 * El cliente sube la captura de su transferencia desde su cita. Se achica a 2000 px por lado en JPG,
 * suficiente para leer el número de la transacción, y pesa unos cientos de KB.
 */
export async function subirComprobante(codigo: string, archivo: File) {
  const blob = await reducir(archivo, 2000, 'image/jpeg');
  if (DEMO) { await api(`/citas/${codigo}/comprobante`, { imagen: await aDataUrl(blob) }); return; }
  let r: Response;
  try {
    r = await fetch(`${API}/api/citas/${encodeURIComponent(codigo)}/comprobante`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
  } catch { throw new ErrorApi('Sin conexión. Revisa tu internet.', 0, null); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(d?.error ?? 'No se pudo enviar la captura.', r.status, d);
}

/** El personal ve el comprobante (es privado: se pide con la sesión). Devuelve una dirección para <img>. */
export async function urlComprobante(citaId: number): Promise<string> {
  if (DEMO) return (await api(`/citas/${citaId}/comprobante`)).imagen;
  let r: Response;
  try {
    r = await fetch(`${API}/api/citas/${citaId}/comprobante`, { headers: { authorization: `Bearer ${token.leer()}` } });
  } catch { throw new ErrorApi('Sin conexión. Revisa tu internet.', 0, null); }
  if (!r.ok) throw new ErrorApi((await r.json().catch(() => ({})))?.error ?? 'No se pudo abrir el comprobante.', r.status, null);
  return URL.createObjectURL(await r.blob());
}
