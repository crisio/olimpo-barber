-- Notificaciones al personal: push del navegador y WhatsApp al barbero.
CREATE TABLE suscripciones_push (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  barbero_id INTEGER,                 -- de quién es el dispositivo (NULL = dueño por correo)
  admin INTEGER NOT NULL DEFAULT 0,   -- recibe avisos de todas las citas
  creado_en TEXT NOT NULL
);
-- Valores internos del servidor (por ejemplo, el par de claves VAPID). Nunca se exponen por la API.
CREATE TABLE claves (
  nombre TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
ALTER TABLE barberos ADD COLUMN telefono TEXT;   -- WhatsApp del barbero para avisos de citas nuevas
