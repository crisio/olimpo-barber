import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Aviso } from './ui';
import { EMBLEMA } from './emblema';

const W = 1080, H = 1920; // tamaño de un estado de WhatsApp

/** Dirección pública del sitio. En una computadora de pruebas (localhost) el QR igual apunta al sitio real. */
export function urlPublica() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? (import.meta.env.VITE_WEB_URL || 'https://olimpobarberclub.pensolabs.com/') : `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Dibuja la imagen vertical con el QR para publicar en estados. */
async function dibujar(url: string): Promise<HTMLCanvasElement> {
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
  // Emblema y nombre de Olimpo Barber Club
  const emblema = new Image();
  emblema.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 175" color="#f3ead7">${EMBLEMA}</svg>`);
  await emblema.decode().catch(() => {});
  if (emblema.naturalWidth || emblema.complete) x.drawImage(emblema, (W - 720) / 2, 100, 720, 315);
  const marca = (t: string, y: number, px: number) => { x.font = `500 ${px}px "Playfair Display", Didot, Georgia, serif`; x.fillStyle = '#f3ead7'; x.fillText(t, W / 2, y); };
  marca('OLIMPO', 570, 190);
  marca('B A R B E R   C L U B', 650, 54);
  x.fillStyle = '#f3ead7'; x.fillRect(120, 632, 150, 3); x.fillRect(W - 270, 632, 150, 3);
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
  const [img, setImg] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [msj, setMsj] = useState('');
  useEffect(() => {
    let vivo = true;
    dibujar(url).then((c) => c.toBlob((b) => {
      if (!b || !vivo) return;
      setArchivo(new File([b], 'olimpo-barber-qr.png', { type: 'image/png' }));
      setImg(c.toDataURL('image/png'));
    }, 'image/png')).catch(() => setMsj('No se pudo crear la imagen en este navegador.'));
    return () => { vivo = false; };
  }, [url]);

  function descargar() {
    const a = document.createElement('a'); a.href = img; a.download = 'olimpo-barber-qr.png'; a.click();
    setMsj('Imagen guardada. Ábrela desde WhatsApp → Novedades → Mi estado.');
  }
  async function compartir() {
    if (!archivo) return;
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], text: `Agenda tu cita en Olimpo Barber Club: ${url}` }); }
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
