# TurnoYa · Olimpo Barber

Citas en línea para Olimpo Barber. El cliente escanea un QR, elige día y hora, y llega directo, sin esperar en la barbería. Funciona desde el celular, sin instalar nada y sin crear cuenta.

## Cómo funciona

- **Citas de 1 hora.** El cliente elige servicio (Corte L 150, Barba L 100, Cejas L 50), barbero y hora.
- **Horario** de 10:00 a.m. a 9:00 p.m.; de 12:00 a 1:00 p.m. es almuerzo y no se reserva. Se reserva al menos 1 hora antes.
- **Cancelar o cambiar hora.** Al liberarse una hora, quienes tienen cita más tarde ese día ven el botón para adelantarla (y reciben aviso por WhatsApp si está conectado).
- **10 minutos de tolerancia.** Pasado ese tiempo el barbero puede marcar "No llegó".
- **Recargo para recuperar.** Quien perdió su hora puede tomar otra pagando un recargo (L 50 por defecto).
- Duración, tolerancia, recargo, horario, barberos y servicios se cambian desde el panel del dueño.

| Ruta | Para quién | Qué hace |
|---|---|---|
| `/` | Cliente | Inicio: horario, próxima hora libre, servicios y precios |
| `/agendar` | Cliente | Reserva en 4 pasos |
| `/c/CODIGO` | Cliente | Su cita: cuenta regresiva, ticket, cancelar, recuperar, avisos por WhatsApp |
| `/barbero` | Barbero | Entra con PIN. Botones: Llegó, Terminé, No llegó, Pausa. Agrega clientes a mano |
| `/dueno` | Dueño | Entra con código por correo o Face ID. Panel, agenda, ajustes, clientes, WhatsApp, cartel QR |
| `/pantalla` | TV | Agenda del día en vivo, solo nombre e inicial |
| `/privacidad` | Todos | Aviso de privacidad |

## Piezas

| Pieza | Tecnología | Carpeta |
|---|---|---|
| Web (PWA) | React + Vite + TypeScript + Tailwind, en GitHub Pages | `web/` |
| API | Cloudflare Worker (Hono) | `worker/` |
| Base de datos | Cloudflare D1 (`turnoya`) | `worker/migrations/` |
| Archivos | Cloudflare R2 (`turnoya-archivos`), fotos de barberos | — |
| Correo de acceso | Resend | — |
| Face ID / huella | Passkeys (WebAuthn) | — |
| Anti-bots | Cloudflare Turnstile (opcional) | — |
| Despliegue | GitHub Actions | `.github/workflows/deploy.yml` |

## Modo demostración

Si la web se publica sin la variable `API_URL`, funciona sola con datos de ejemplo guardados en el navegador, para revisar el diseño. Muestra una franja azul que lo indica. PIN de barbero: `1111`. Dueño: cualquier correo; el código aparece ya escrito.

La guía para conectar Cloudflare paso a paso está en [`docs/CONFIGURAR-CLOUDFLARE.md`](docs/CONFIGURAR-CLOUDFLARE.md).

## Probar en tu computadora

Necesitas Node 22.

```bash
# Terminal 1: API con base local y datos de ejemplo
cd worker
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev            # http://localhost:8787

# Terminal 2: web
cd web
npm install
cp .env.example .env.local
npm run dev            # http://localhost:5173
```

Accesos de ejemplo (solo en local):

- Barbero: "Barbero Olimpo" con PIN `1111`, "Kevin Mejía" con PIN `2222`.
- Dueño: correo `dueno@ejemplo.com`. En local no se envía correo; el código aparece ya escrito en la pantalla.
- Citas de ejemplo: `/c/DEMD5` (próxima), `/c/DEMC4` (en la silla), `/c/DEMF7` (perdida, para probar el recargo).

En local la barbería abre las 24 horas para poder probar a cualquier hora.

## Publicar

La base D1 `turnoya` ya existe en la cuenta de Cloudflare, con el esquema y la configuración de Olimpo Barber cargados. Falta lo siguiente.

### 1. Secretos y variables en GitHub

En el repositorio: **Settings → Secrets and variables → Actions**.

Secretos:

| Nombre | Qué es |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token de Cloudflare con permisos: Workers Scripts (editar), D1 (editar), R2 (editar) |
| `CLOUDFLARE_ACCOUNT_ID` | ID de la cuenta de Cloudflare |

Variables:

| Nombre | Ejemplo | Qué es |
|---|---|---|
| `API_URL` | `https://api.turnoya.tudominio.com` | Dirección pública del Worker |
| `DOMINIO_WEB` | `turnoya.tudominio.com` | Dominio de la web. Vacío = se publica en `crisio.github.io/olimpo-barber` |
| `TURNSTILE_SITEKEY` | — | Opcional. Clave pública de Turnstile |

Además, en **Settings → Pages**, elige **Source: GitHub Actions**.

### 2. Dominio

1. En `worker/wrangler.toml` descomenta `routes` y pon el subdominio de la API. Cambia también `ORIGEN_WEB` (dirección completa de la web) y `RP_ID` (solo el dominio de la web, sin `https://`). Face ID depende de que `RP_ID` coincida con el dominio de la web.
2. En Cloudflare DNS crea un `CNAME` del subdominio de la web hacia `crisio.github.io`, sin proxy (nube gris).
3. Cambia `RESEND_FROM` por un remitente de un dominio verificado en Resend.

### 3. Secretos del Worker

Desde `worker/`, con `npx wrangler secret put NOMBRE`:

| Nombre | Obligatorio | Qué es |
|---|---|---|
| `OWNER_EMAIL` | Sí | Correo del dueño. Solo este correo puede entrar al panel. Varios separados por coma |
| `RESEND_API_KEY` | Sí | Clave de Resend para enviar el código de acceso |
| `TURNSTILE_SECRET` | No | Clave secreta de Turnstile. Sin ella no se pide verificación |
| `WA_TOKEN` | No | Token permanente de la API de WhatsApp Business (Meta) |
| `WA_PHONE_ID` | No | ID del número de teléfono en Meta |
| `WA_VERIFY_TOKEN` | No | Texto que inventas tú para verificar el webhook |
| `WA_APP_SECRET` | No | Secreto de la app de Meta; valida que los mensajes vienen de Meta |
| `WA_PLANTILLA_RECORDATORIO` | No | Nombre de una plantilla aprobada, con 3 variables: nombre, cuándo, barbero |

### 4. Desplegar

Cada cambio en `main` despliega solo: aplica migraciones de D1, publica el Worker y publica la web.

### 5. Primer ingreso

1. Entra a `/dueno` con el correo de `OWNER_EMAIL` y el código que llega por correo.
2. Toca "Activar Face ID o huella" para no depender del correo.
3. En **Ajustes** revisa horario y dirección, pon el número de WhatsApp de la barbería y asigna un PIN a cada barbero. Sin PIN, el barbero no puede entrar.
4. En **Cartel** imprime el QR.

## WhatsApp

Sin credenciales de Meta la app trabaja en **modo de prueba**: no envía nada y deja cada mensaje en la bitácora del panel (pestaña WhatsApp), donde también se puede simular que un cliente escribe.

El flujo está pensado para no pagar por mensaje:

1. En la pantalla de su cita, el cliente toca "Avisarme por WhatsApp". Se abre su WhatsApp con un mensaje hacia la barbería que lleva su código.
2. El Worker recibe ese mensaje, vincula el teléfono con la cita y responde con la confirmación.
3. Durante las 24 horas siguientes los avisos salen como texto libre. Un cron revisa cada 5 minutos y envía el recordatorio cerca de 1 hora antes de la cita.

Límites que conviene conocer:

- Fuera de esas 24 horas Meta solo permite plantillas aprobadas, que se cobran por mensaje. Si una cita se agendó con más de un día de anticipación y no hay plantilla, el recordatorio no sale y queda en la bitácora como "fuera de las 24 h".
- El respaldo siempre disponible y gratis es el botón "Avisarle por WhatsApp" de la vista del barbero, que abre su propio WhatsApp con el mensaje escrito.
- Los precios de Meta cambian; revísalos antes de activar plantillas.

Para conectar: crea una app en Meta for Developers con el producto WhatsApp, registra el número, apunta el webhook a `https://TU-API/api/whatsapp/webhook` con tu `WA_VERIFY_TOKEN`, suscribe el campo `messages` y carga los secretos de la tabla anterior. Un número que ya se usa en la app normal de WhatsApp Business no puede usarse a la vez en la API sin el proceso de coexistencia de Meta; lo más simple es un número aparte.

## Datos y privacidad

- El teléfono solo lo ve el personal con sesión iniciada. Las rutas públicas devuelven nombre e inicial, nunca teléfonos.
- El teléfono se borra solo 90 días después de la última cita.
- El cliente deja de recibir avisos respondiendo `BAJA`.
- Los PIN y los códigos de acceso se guardan con hash, y hay límite de intentos.

## Pendiente

- Notificaciones push del navegador. Hoy la pantalla de la cita vibra y suena al cambiar de estado si está abierta, y los avisos van por WhatsApp.
- Actualización instantánea con WebSocket. Hoy las pantallas se refrescan solas cada 15 a 30 segundos.
- Cobro del recargo en línea. Hoy se suma al total y se paga en la barbería.
