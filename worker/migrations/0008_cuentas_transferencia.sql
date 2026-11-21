-- Cuentas para que los clientes paguen por transferencia. Lista JSON:
-- [{"id","banco","banco_nombre","tipo","moneda","numero","titular","nota","activa"}]
ALTER TABLE barberia ADD COLUMN cuentas TEXT NOT NULL DEFAULT '[]';
