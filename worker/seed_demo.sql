-- Datos de ejemplo SOLO para desarrollo local (PIN: Olimpo 1111, Kevin 2222)
UPDATE barberos SET pin_hash = 'a1b2c3d4e5f60718:b1b825e42796cfe77cdcecbde92ae2514d563effd7e44abe620682f3495af200' WHERE id = 1;
INSERT INTO barberos (nombre, apodo, orden, pin_hash) VALUES
 ('Kevin Mejía', 'Kevin', 2, '0f1e2d3c4b5a6978:d68091e3d7d0fe79016c171676edb485f9c6e31de87bd5392d0acbbf6f8520ca');
UPDATE barberia SET whatsapp_numero = '50499990000';
INSERT INTO clientes (telefono, nombre, consentimiento, wa_verificado, ultimo_entrante_en, visitas, creado_en) VALUES
 ('50433112233', 'Óscar López', 1, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now'), 3, strftime('%Y-%m-%dT%H:%M:%SZ','now')),
 ('50498765432', 'Kenia Andino', 1, 0, NULL, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now'));
-- Citas de hoy relativas a la hora actual de Honduras
INSERT INTO citas (codigo, barbero_id, inicio, estado, nombre, nombre_publico, telefono, cliente_id, servicios, total_l, origen, creado_en, llego_en, terminado_en) VALUES
 ('DEMA2', 1, strftime('%Y-%m-%dT%H:00','now','-6 hours','-2 hours'), 'terminada', 'Marlon Pineda', 'Marlon P.', NULL, NULL, '[{"id":1,"nombre":"Corte","precio_l":150}]', 150, 'web', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:03','now','-6 hours','-2 hours'), strftime('%Y-%m-%dT%H:40','now','-6 hours','-2 hours')),
 ('DEMB3', 1, strftime('%Y-%m-%dT%H:00','now','-6 hours','-1 hours'), 'agendada', 'Josué Rivera', 'Josué R.', NULL, NULL, '[{"id":1,"nombre":"Corte","precio_l":150},{"id":3,"nombre":"Cejas","precio_l":50}]', 200, 'web', strftime('%Y-%m-%dT%H:%M:%SZ','now'), NULL, NULL),
 ('DEMC4', 1, strftime('%Y-%m-%dT%H:00','now','-6 hours'), 'en_atencion', 'Óscar López', 'Óscar L.', '50433112233', 1, '[{"id":1,"nombre":"Corte","precio_l":150},{"id":2,"nombre":"Barba","precio_l":100}]', 250, 'web', strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:02','now','-6 hours'), NULL),
 ('DEMD5', 1, strftime('%Y-%m-%dT%H:00','now','-6 hours','+1 hours'), 'agendada', 'Kenia Andino', 'Kenia A.', '50498765432', 2, '[{"id":3,"nombre":"Cejas","precio_l":50}]', 50, 'web', strftime('%Y-%m-%dT%H:%M:%SZ','now'), NULL, NULL),
 ('DEME6', 2, strftime('%Y-%m-%dT%H:00','now','-6 hours','+1 hours'), 'agendada', 'Daniel Flores', 'Daniel F.', NULL, NULL, '[{"id":2,"nombre":"Barba","precio_l":100}]', 100, 'manual', strftime('%Y-%m-%dT%H:%M:%SZ','now'), NULL, NULL),
 ('DEMF7', 2, strftime('%Y-%m-%dT%H:00','now','-6 hours','-3 hours'), 'no_llego', 'Wilmer Zelaya', 'Wilmer Z.', NULL, NULL, '[{"id":1,"nombre":"Corte","precio_l":150}]', 150, 'web', strftime('%Y-%m-%dT%H:%M:%SZ','now'), NULL, NULL);
