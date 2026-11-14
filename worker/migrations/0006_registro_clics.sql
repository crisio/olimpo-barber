-- Registro de uso: cada toque en botones y enlaces, por usuario o por dispositivo si no hay sesión.
CREATE TABLE eventos_clic (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispositivo TEXT NOT NULL,          -- identificador anónimo del navegador (un navegador no puede leer la MAC)
  usuario TEXT,                       -- nombre del barbero o 'Dueño' si hay sesión; NULL = cliente sin cuenta
  ruta TEXT NOT NULL,
  elemento TEXT NOT NULL,             -- texto del botón o enlace tocado
  creado_en TEXT NOT NULL
);
CREATE INDEX ix_clic_creado ON eventos_clic(creado_en);
CREATE INDEX ix_clic_disp ON eventos_clic(dispositivo, creado_en);
UPDATE barberia SET direccion = 'Quimistán, Santa Bárbara' WHERE direccion = 'Tegucigalpa, Honduras';
