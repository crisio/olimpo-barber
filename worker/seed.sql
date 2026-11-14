-- Configuración real de Olimpo Barber (se puede editar desde el panel del dueño)
INSERT OR IGNORE INTO barberia (id, nombre, direccion, horario) VALUES
 (1, 'Olimpo Barber', 'Tegucigalpa, Honduras',
  '{"0":null,"1":["09:00","19:00"],"2":["09:00","19:00"],"3":["09:00","19:00"],"4":["09:00","19:00"],"5":["09:00","19:00"],"6":["09:00","19:00"]}');
INSERT INTO servicios (nombre, descripcion, precio_l, orden)
 SELECT 'Corte', 'Corte de cabello a tu estilo', 150, 1 WHERE NOT EXISTS (SELECT 1 FROM servicios);
INSERT INTO servicios (nombre, descripcion, precio_l, orden)
 SELECT 'Barba', 'Perfilado y arreglo de barba', 100, 2 WHERE (SELECT COUNT(*) FROM servicios) = 1;
INSERT INTO servicios (nombre, descripcion, precio_l, orden)
 SELECT 'Cejas', 'Limpieza y diseño de cejas', 50, 3 WHERE (SELECT COUNT(*) FROM servicios) = 2;
INSERT INTO barberos (nombre, apodo, orden)
 SELECT 'Barbero Olimpo', 'Olimpo', 1 WHERE NOT EXISTS (SELECT 1 FROM barberos);
