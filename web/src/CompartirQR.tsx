import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Aviso } from './ui';
import { EMBLEMA } from './emblema';
import { Marca, urlArchivo, useMarca } from './marca';

const W = 1080, H = 1920; // tamaño de un estado de WhatsApp

/** Dirección pública del sitio. En una computadora de pruebas (localhost) el QR igual apunta al sitio real. */
export function urlPublica() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? (import.meta.env.VITE_WEB_URL || 'https://olimpobarberclub.pensolabs.com/') : `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Dibuja la imagen vertical con el QR para publicar en estados. */
const cargarImagen = async (src: string, cors: boolean) => {
  const img = new Image();
  // Con CORS el lienzo no queda "contaminado" y se puede exportar; si el servidor no lo permite, se omite la imagen
  if (cors) img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  return img;
};

async function dibujar(url: string, m: Marca): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('800 100px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow"'), document.fonts.load('500 100px "Playfair Display"')]).catch(() => {});
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0d0f14'; x.fillRect(0, 0, W, H);
  // Franjas de poste de barbero arriba y abajo
  const franja = (y: number) => {
    const colores = ['#e23a3a', '#f3ead7', '#2f6bff', '#f3ead7'], alto = 56, paso = 70;
    x.save(); x.beginPath(); x.rect(0, y, W, alto); x.clip();
    for (let i = -2; i * paso < W + alto; i++) {
      x.fillStyle = colores[((i % 4) + 4) % 4];
      x.beginPath(); x.moveTo(i * paso, y + alto); x.lineTo(i * paso + alto, y); x.lineTo((i + 1) * paso + alto, y); x.lineTo((i + 1) * paso, y + alto); x.fill();
    }
    x.restore();
  };
  franja(0); franja(H - 56);
  x.textAlign = 'center';
  const titulo = (t: string, y: number, px: number, color: string) => { x.font = `800 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`; x.fillStyle = color; x.fillText(t, W / 2, y); };
  const texto = (t: string, y: number, px: number, color: string, peso = 600) => { x.font = `${peso} ${px}px "Barlow", sans-serif`; x.fillStyle = color; x.fillText(t, W / 2, y); };
  // Logo del negocio (el que subió el dueño o el emblema original) y su nombre
  const logo = urlArchivo(m.logo_key);
  const nombreLogo = m.marca_titulo || m.nombre;
  const sub = m.marca_titulo ? m.marca_subtitulo : '';
  const conTexto = !logo || !!m.logo_con_texto;
  const caja = conTexto ? { y: 100, alto: 315 } : { y: 110, alto: 560 }; // sin texto, el logo ocupa más
  const imagen = logo
    ? await cargarImagen(logo.startsWith('data:') ? logo : `${logo}?lienzo=1`, !logo.startsWith('data:')).catch(() => null)
    : await cargarImagen('data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 175" color="#f3ead7">${EMBLEMA}</svg>`), false).catch(() => null);
  if (imagen) {
    const iw = imagen.naturalWidth || 400, ih = imagen.naturalHeight || 175;
    const e = Math.min(720 / iw, caja.alto / ih);
    x.drawImage(imagen, (W - iw * e) / 2, caja.y + (caja.alto - ih * e) / 2, iw * e, ih * e);
  }
  const marca = (t: string, y: number, px: number) => {
    x.font = `500 ${px}px "Playfair Display", Didot, Georgia, serif`;
    // Achica el texto si no cabe a lo ancho
    const ancho = x.measureText(t).width;
    if (ancho > W - 120) x.font = `500 ${Math.floor((px * (W - 120)) / ancho)}px "Playfair Display", Didot, Georgia, serif`;
    x.fillStyle = '#f3ead7'; x.fillText(t, W / 2, y);
    return Math.min(ancho, W - 120);
  };
  if (conTexto) {
    marca(nombreLogo, 570, nombreLogo.length <= 8 ? 190 : 150);
    if (sub) {
      const ancho = marca(sub.split('').join(' '), 650, 54);
      const lado = 150, hueco = 30, inicio = (W - ancho) / 2 - hueco - lado;
      if (inicio >= 40) { x.fillStyle = '#f3ead7'; x.fillRect(inicio, 632, lado, 3); x.fillRect(W - inicio - lado, 632, lado, 3); }
    }
  }
  titulo('AGENDA TU CITA', 830, 130, '#f3ead7');
  texto('Elige tu hora y llega directo', 895, 46, '#9aa1b2');
  // QR sobre tarjeta blanca
  const lado = 640, qx = (W - lado) / 2, qy = 965;
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(qx - 36, qy - 36, lado + 72, lado + 72, 44); x.fill();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: lado, margin: 0, errorCorrectionLevel: 'M' });
  x.drawImage(qr, qx, qy, lado, lado);
  titulo('ESCANEA EL CÓDIGO', 1730, 76, '#f3ead7');
  texto(new URL(url).host, 1790, 46, '#f3ead7');
  texto('Gratis · sin descargar nada · sin crear cuenta', 1842, 34, '#9aa1b2', 400);
  return c;
}

export default function CompartirQR({ barberoId }: { barberoId?: number | null }) {
  const url = `${urlPublica()}${barberoId ? `agendar?barbero=${barberoId}` : ''}`;
  const m = useMarca();
  const [img, setImg] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [msj, setMsj] = useState('');
  useEffect(() => {
    let vivo = true;
    dibujar(url, m).then((c) => c.toBlob((b) => {
      if (!b || !vivo) return;
      setArchivo(new File([b], 'agenda-qr.png', { type: 'image/png' }));
      setImg(c.toDataURL('image/png'));
    }, 'image/png')).catch(() => setMsj('No se pudo crear la imagen en este navegador.'));
    return () => { vivo = false; };
  }, [url, m]);

  function descargar() {
    const a = document.createElement('a'); a.href = img; a.download = 'agenda-qr.png'; a.click();
    setMsj('Imagen guardada. Ábrela desde WhatsApp → Novedades → Mi estado.');
  }
  async function compartir() {
    if (!archivo) return;
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], text: `Agenda tu cita en ${m.nombre}: ${url}` }); }
      catch (e: any) { if (e?.name !== 'AbortError') descargar(); }
    } else descargar();
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(url); setMsj('Enlace copiado.'); } catch { setMsj(url); }
  }
  return (
    <div>
      <h2 className="titulo text-3xl">QR para tus estados</h2>
      <p className="mt-1 text-tenue">Publica esta imagen en tu estado de WhatsApp. Quien la escanee{barberoId ? ' agenda directo contigo' : ' llega a la agenda'}.</p>
      {msj && <div className="mt-3"><Aviso tono="azul">{msj}</Aviso></div>}
      <button className="btn btn-verde mt-4 !min-h-16 !text-2xl" disabled={!archivo} onClick={compartir}>Compartir en WhatsApp</button>
      <p className="mt-2 text-center text-sm text-tenue">Elige WhatsApp y luego “Mi estado”.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn btn-linea !text-lg" disabled={!img} onClick={descargar}>Guardar imagen</button>
        <button className="btn btn-linea !text-lg" onClick={copiar}>Copiar enlace</button>
      </div>
      {img ? <img src={img} alt={`Imagen para estados con el código QR hacia ${url}`} className="mx-auto mt-4 w-2/3 rounded-2xl border border-borde" />
        : <div className="poste poste-anim mx-auto mt-6 h-3 w-40 rounded-full" />}
    </div>
  );
}
