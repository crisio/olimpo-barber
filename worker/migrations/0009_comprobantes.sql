-- Captura del comprobante de transferencia que sube el cliente desde su cita. Es privada:
-- solo la ve el personal con sesión, y se borra a los 90 días junto con el teléfono.
ALTER TABLE citas ADD COLUMN comprobante_key TEXT;
ALTER TABLE citas ADD COLUMN comprobante_en TEXT;
