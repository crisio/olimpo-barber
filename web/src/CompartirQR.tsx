import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Aviso } from './ui';

const W = 1080, H = 1920; // tamaño de un estado de WhatsApp

/** Dirección pública del sitio. En una computadora de pruebas (localhost) el QR igual apunta al sitio real. */
export function urlPublica() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return local ? (import.meta.env.VITE_WEB_URL || 'https://olimpobarberclub.pensolabs.com/') : `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Dibuja la imagen vertical con el QR para publicar en estados. */
async function dibujar(url: string): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('800 100px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow"')]).catch(() => {});
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
  // OLIMPO BARBER en dos colores, centrado
  x.font = '800 158px "Barlow Condensed", "Arial Narrow", sans-serif';
  const a = 'OLIMPO ', b = 'BARBER', ancho = x.measureText(a + b).width, ini = (W - ancho) / 2;
  x.textAlign = 'left'; x.fillStyle = '#f3ead7'; x.fillText(a, ini, 320); x.fillStyle = '#e23a3a'; x.fillText(b, ini + x.measureText(a).width, 320);
  x.textAlign = 'center';
  titulo('AGENDA TU CITA', 520, 150, '#f3ead7');
  texto('Elige tu hora y llega directo', 600, 52, '#9aa1b2');
  // QR sobre tarjeta blanca
  const lado = 760, qx = (W - lado) / 2, qy = 690;
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(qx - 40, qy - 40, lado + 80, lado + 80, 48); x.fill();
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { width: lado, margin: 0, errorCorrectionLevel: 'M' });
  x.drawImage(qr, qx, qy, lado, lado);
  titulo('ESCANEA EL CÓDIGO', 1620, 96, '#f3ead7');
  texto(new URL(url).host, 1700, 54, '#f3ead7');
  texto('Gratis · sin descargar nada · sin crear cuenta', 1780, 40, '#9aa1b2', 400);
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
      try { await navigator.share({ files: [archivo], text: `Agenda tu cita en Olimpo Barber: ${url}` }); }
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
