import { Link } from 'react-router-dom';
import { Logo, Pagina, Poste } from '../ui';

export default function Privacidad() {
  return (
    <Pagina>
      <Logo />
      <Poste className="mt-4" />
      <h1 className="titulo mt-5 text-5xl">Aviso de privacidad</h1>
      <div className="mt-4 grid gap-4 text-base leading-relaxed">
        <p><b>Usamos tu nombre para llamarte y tu teléfono solo para avisarte. No lo compartimos ni lo mostramos en pantallas.</b></p>
        <p><b>Qué guardamos.</b> Tu nombre, el servicio y la hora de tu cita. Si lo das, tu número de WhatsApp. También un identificador de tu navegador para que no se dupliquen citas.</p>
        <p><b>Para qué.</b> Para reservar tu hora, recordarte la cita y avisarte de cambios. En la pantalla de la barbería solo aparece tu nombre y la inicial de tu apellido.</p>
        <p><b>WhatsApp.</b> Solo te escribimos si tú nos escribes primero o si dejaste tu número. Puedes dejar de recibir avisos respondiendo <b>BAJA</b>.</p>
        <p><b>Cuánto tiempo.</b> Borramos tu teléfono automáticamente 90 días después de tu última cita.</p>
        <p><b>Quién lo ve.</b> Solo el personal de Olimpo Barber Club. No vendemos ni compartimos tus datos con nadie.</p>
        <p><b>Tus derechos.</b> Puedes pedir que corrijamos o borremos tus datos en cualquier momento, en la barbería o por WhatsApp.</p>
      </div>
      <Link to="/" className="btn btn-crema mt-8">Volver al inicio</Link>
    </Pagina>
  );
}
