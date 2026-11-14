-- TurnoYa · Olimpo Barber — esquema inicial (D1 / SQLite)
-- Las horas locales se guardan como 'YYYY-MM-DDTHH:MM' en hora de Honduras (UTC-6, sin horario de verano).

CREATE TABLE barberia (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL DEFAULT '',
  whatsapp_numero TEXT,                       -- número de WhatsApp Business (solo dígitos, con 504)
  horario TEXT NOT NULL,                      -- JSON {"0":null,"1":["09:00","19:00"],...} 0 = domingo
  duracion_cita_min INTEGER NOT NULL DEFAULT 60,
  tolerancia_min INTEGER NOT NULL DEFAULT 10,
  recargo_l INTEGER NOT NULL DEFAULT 50,      -- recargo para recuperar una cita perdida
  dias_anticipacion INTEGER NOT NULL DEFAULT 14,
  agenda_abierta INTEGER NOT NULL DEFAULT 1,
  logo_key TEXT
);

CREATE TABLE barberos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apodo TEXT,
  foto_key TEXT,
  pin_hash TEXT,                              -- 'sal:hash' PBKDF2; NULL = aún no puede entrar
  orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  precio_l INTEGER NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telefono TEXT UNIQUE,                       -- se borra a los 90 días de la última visita
  nombre TEXT NOT NULL,
  consentimiento INTEGER NOT NULL DEFAULT 0,  -- aceptó recibir avisos
  wa_verificado INTEGER NOT NULL DEFAULT 0,   -- escribió al WhatsApp de la barbería
  ultimo_entrante_en TEXT,                    -- UTC ISO; abre la ventana gratis de 24 h
  visitas INTEGER NOT NULL DEFAULT 0,
  no_llegadas INTEGER NOT NULL DEFAULT 0,
  ultima_cita TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,                -- código corto tipo K7P2Q
  barbero_id INTEGER NOT NULL REFERENCES barberos(id),
  inicio TEXT NOT NULL,                       -- hora local
  estado TEXT NOT NULL DEFAULT 'agendada'
    CHECK (estado IN ('agendada','en_atencion','terminada','no_llego','cancelada')),
  nombre TEXT NOT NULL,
  nombre_publico TEXT NOT NULL,               -- "Óscar L."
  telefono TEXT,
  cliente_id INTEGER REFERENCES clientes(id),
  dispositivo TEXT,
  servicios TEXT NOT NULL,                    -- JSON [{id,nombre,precio_l}]
  total_l INTEGER NOT NULL,
  recargo_l INTEGER NOT NULL DEFAULT 0,
  origen TEXT NOT NULL DEFAULT 'web' CHECK (origen IN ('web','manual')),
  recuperada_de INTEGER REFERENCES citas(id),
  recuperada INTEGER NOT NULL DEFAULT 0,
  recordatorio_enviado INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL,
  llego_en TEXT,
  terminado_en TEXT
);
-- Una sola cita viva por barbero y hora
CREATE UNIQUE INDEX ux_cita_hora ON citas(barbero_id, inicio)
  WHERE estado IN ('agendada','en_atencion','terminada');
CREATE INDEX ix_citas_inicio ON citas(inicio);
CREATE INDEX ix_citas_dispositivo ON citas(dispositivo);

CREATE TABLE bloqueos (
  barbero_id INTEGER NOT NULL REFERENCES barberos(id),
  inicio TEXT NOT NULL,
  PRIMARY KEY (barbero_id, inicio)
);

-- Acceso
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'dueno',
  creado_en TEXT NOT NULL
);
CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,
  rol TEXT NOT NULL CHECK (rol IN ('dueno','barbero')),
  usuario_id INTEGER,
  barbero_id INTEGER,
  expira_en TEXT NOT NULL
);
CREATE TABLE codigos_login (
  email TEXT PRIMARY KEY,
  codigo_hash TEXT NOT NULL,
  expira_en TEXT NOT NULL
);
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,                        -- credential id (base64url)
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  clave_publica TEXT NOT NULL,                -- base64
  contador INTEGER NOT NULL DEFAULT 0,
  transportes TEXT,
  creado_en TEXT NOT NULL
);
CREATE TABLE retos (
  id TEXT PRIMARY KEY,
  reto TEXT NOT NULL,
  usuario_id INTEGER,
  expira_en TEXT NOT NULL
);
CREATE TABLE intentos (
  clave TEXT NOT NULL,
  cuando TEXT NOT NULL
);
CREATE INDEX ix_intentos ON intentos(clave, cuando);

-- WhatsApp
CREATE TABLE whatsapp_mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direccion TEXT NOT NULL CHECK (direccion IN ('entrante','saliente')),
  telefono TEXT NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  estado TEXT NOT NULL,                       -- simulado, enviado, entregado, leido, error, fuera_de_ventana, recibido
  wa_id TEXT,
  detalle TEXT,
  cita_id INTEGER,
  creado_en TEXT NOT NULL
);
CREATE INDEX ix_wa_creado ON whatsapp_mensajes(creado_en);
