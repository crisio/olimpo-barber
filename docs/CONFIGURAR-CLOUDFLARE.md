# Configurar Cloudflare para TurnoYa · Olimpo Barber

Guía paso a paso para quien haga la configuración. No hace falta programar. Tiempo estimado: 30 a 45 minutos.

Al terminar, la app deja de estar en modo demostración y guarda citas reales.

## Antes de empezar

Necesitas:

- Acceso a la cuenta de **Cloudflare** donde está el dominio `pensolabs.com`.
- Acceso de administrador al repositorio **crisio/olimpo-barber** en GitHub.
- Acceso a la cuenta de **Resend**.
- El **correo del dueño** de la barbería (el único que podrá entrar al panel).

Decide dos direcciones y anótalas. En esta guía se usan estos ejemplos; cámbialos por el dominio real:

| Qué | Ejemplo |
|---|---|
| Web (lo que abre el cliente) | `olimpobarberclub.pensolabs.com` |
| API | `api-turnoya.pensolabs.com` |

Ya está hecho y **no hay que repetirlo**: la base de datos D1 llamada `turnoya` existe, con sus tablas y los datos de Olimpo Barber.

Lo que de verdad falta hoy son los pasos **1 a 4** (token de Cloudflare en GitHub), el **7** (clave de Resend), el **8** (desplegar) y el **9** (secretos del Worker).

---

## Paso 1. Anotar el ID de la cuenta de Cloudflare

1. Entra a <https://dash.cloudflare.com>.
2. Abre **Workers & Pages**.
3. En la columna derecha copia el **Account ID**.

## Paso 2. Activar R2 (almacenamiento de fotos)

1. En el menú izquierdo abre **R2 Object Storage**.
2. Si pide activar el servicio, complétalo. Pide una tarjeta aunque el uso entra en el plan gratis.
3. No crees ningún bucket: el despliegue crea `turnoya-archivos` solo.

## Paso 3. Crear el token de Cloudflare

1. Arriba a la derecha: icono de usuario → **My Profile** → **API Tokens** → **Create Token**.
2. Elige **Create Custom Token**.
3. Nombre: `turnoya-github`.
4. En **Permissions** agrega estas filas:

   | Tipo | Recurso | Permiso |
   |---|---|---|
   | Account | Workers Scripts | Edit |
   | Account | D1 | Edit |
   | Account | Workers R2 Storage | Edit |
   | Zone | Workers Routes | Edit |
   | Zone | DNS | Edit |

5. En **Account Resources** elige la cuenta. En **Zone Resources** elige el dominio `pensolabs.com`.
6. **Continue to summary** → **Create Token**.
7. Copia el token. Solo se muestra una vez.

## Paso 4. Guardar los secretos en GitHub

1. Abre <https://github.com/crisio/olimpo-barber/settings/secrets/actions>.
2. Pestaña **Secrets** → **New repository secret**. Crea dos:

   | Nombre | Valor |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | El token del paso 3 |
   | `CLOUDFLARE_ACCOUNT_ID` | El Account ID del paso 1 |

3. Pestaña **Variables** → **New repository variable**. Crea dos:

   | Nombre | Valor |
   |---|---|
   | `API_URL` | `https://api-turnoya.pensolabs.com` |
   | `DOMINIO_WEB` | `olimpobarberclub.pensolabs.com` |

   Sin `https://` en `DOMINIO_WEB`. Con `https://` en `API_URL`.

## Paso 5. Crear el registro DNS de la web

La web ya abre en `olimpobarberclub.pensolabs.com`, así que este registro ya existe. Solo revisa que esté como se indica; si es así, sigue al paso 7.

1. En Cloudflare abre el dominio `pensolabs.com` → **DNS** → **Records** → **Add record**.
2. Llena así:

   | Campo | Valor |
   |---|---|
   | Type | `CNAME` |
   | Name | `olimpobarberclub` |
   | Target | `crisio.github.io` |
   | Proxy status | **DNS only** (nube gris) |

3. **Save**.

El registro de la API no se crea a mano: lo crea el despliegue.

## Paso 6. Dirección de la API en el código (ya está hecho)

No hay que tocar nada. El archivo `worker/wrangler.toml` ya tiene la dirección de la API (`api-turnoya.pensolabs.com`), la de la web (`olimpobarberclub.pensolabs.com`), el remitente y la plantilla de Resend.

Solo si algún día cambia la dirección de la web hay que editar `ORIGEN_WEB`, `RP_ID` y `WEB_URL` en ese archivo. `RP_ID` debe ser exactamente el dominio de la web, sin `https://`; si no coincide, Face ID no funciona.

## Paso 7. Crear la clave de Resend

El dominio `pensolabs.com` ya está verificado en Resend, con el remitente `olimpobarberclub@pensolabs.com` y la plantilla `olimpo-verificacion` publicada. Solo falta la clave:

1. Entra a <https://resend.com/api-keys> → **Create API Key**.
2. Nombre: `turnoya`. Permiso: **Sending access**. Dominio: `pensolabs.com`.
3. Copia la clave. Solo se muestra una vez.

## Paso 8. Desplegar por primera vez

1. Abre <https://github.com/crisio/olimpo-barber/actions>.
2. Elige **Desplegar TurnoYa** → **Run workflow** → rama `main` → **Run workflow**.
3. Espera a que los dos trabajos queden en verde: **API** y **Web**.

Si **API** falla en "Crear bucket R2", falta el paso 2.

## Paso 9. Guardar los secretos del Worker

1. En Cloudflare: **Workers & Pages** → `turnoya-api` → **Settings** → **Variables and Secrets** → **Add**.
2. Agrega cada uno con tipo **Secret**:

   | Nombre | Valor | Obligatorio |
   |---|---|---|
   | `OWNER_EMAIL` | Correo del dueño | Sí |
   | `RESEND_API_KEY` | La clave del paso 7 | Sí |

3. **Deploy** para aplicar.

## Paso 10. Activar el dominio en GitHub Pages

El dominio ya está activo. Solo confirma que **Enforce HTTPS** esté marcado.

1. Abre <https://github.com/crisio/olimpo-barber/settings/pages>.
2. En **Custom domain** debe aparecer `olimpobarberclub.pensolabs.com`. Si está vacío, escríbelo y **Save**.
3. Cuando termine la verificación, marca **Enforce HTTPS**.

## Paso 11. Comprobar que funciona

1. Abre `https://api-turnoya.pensolabs.com/api/barberia`. Debe mostrar texto con "Olimpo Barber".
2. Abre `https://olimpobarberclub.pensolabs.com`. Ya no debe aparecer la franja azul de "Demostración".
3. Reserva una cita de prueba.
4. Abre `https://olimpobarberclub.pensolabs.com/dueno`, entra con el correo del dueño y el código que llega por correo.
5. En **Ajustes** asigna un PIN a cada barbero.
6. En el panel toca **Activar Face ID o huella**.

---

## Opcional. Verificación anti-bots (Turnstile)

1. En Cloudflare: **Turnstile** → **Add widget**. Dominio: `olimpobarberclub.pensolabs.com`. Modo **Managed**.
2. Copia la **Site Key** a GitHub como variable `TURNSTILE_SITEKEY` (paso 4).
3. Copia la **Secret Key** al Worker como secreto `TURNSTILE_SECRET` (paso 9).
4. Vuelve a correr el despliegue (paso 8).

## Opcional. WhatsApp Business

Sin esto la app trabaja en modo de prueba: no envía mensajes y los deja en una bitácora del panel.

Hace falta una app en Meta for Developers con el producto WhatsApp y un número registrado en la API. Un número que ya se usa en la app normal de WhatsApp Business no sirve a la vez; lo más simple es un número aparte.

1. En la app de Meta: **WhatsApp → Configuration → Webhook**.
   - Callback URL: `https://api-turnoya.pensolabs.com/api/whatsapp/webhook`
   - Verify token: inventa un texto largo y anótalo.
   - Suscribe el campo `messages`.
2. Agrega estos secretos al Worker (paso 9):

   | Nombre | Valor |
   |---|---|
   | `WA_TOKEN` | Token permanente de la API de WhatsApp |
   | `WA_PHONE_ID` | Phone number ID |
   | `WA_VERIFY_TOKEN` | El texto que inventaste |
   | `WA_APP_SECRET` | App Secret (Meta: **App settings → Basic**) |
   | `WA_PLANTILLA_RECORDATORIO` | Opcional. Nombre de una plantilla aprobada con 3 variables: nombre, cuándo, barbero |
   | `WA_PLANTILLA_PERSONAL` | Opcional. Plantilla para avisar al barbero de citas nuevas, con 3 variables: título, detalle, código |

3. En el panel del dueño, pestaña **WhatsApp**, debe decir "Conectado a WhatsApp Business".
4. En **Ajustes** escribe el número de WhatsApp de la barbería.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La web sigue en "Demostración" | Falta la variable `API_URL` o no se volvió a desplegar |
| La web dice "Sin conexión" | `ORIGEN_WEB` no coincide con la dirección real de la web |
| No llega el código por correo | El dominio no está verificado en Resend, o `OWNER_EMAIL` tiene otro correo |
| Face ID falla | `RP_ID` no es exactamente el dominio de la web |
| El barbero no puede entrar | El dueño aún no le asignó PIN en Ajustes |
