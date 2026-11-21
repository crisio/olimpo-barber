-- Configuración del negocio desde el panel: textos del logo, descripción, mapa y redes sociales.
ALTER TABLE barberia ADD COLUMN marca_titulo TEXT NOT NULL DEFAULT '';      -- texto grande del logo (vacío = el nombre)
ALTER TABLE barberia ADD COLUMN marca_subtitulo TEXT NOT NULL DEFAULT '';   -- texto pequeño debajo
ALTER TABLE barberia ADD COLUMN logo_con_texto INTEGER NOT NULL DEFAULT 1;  -- 0 = la imagen del logo ya trae el nombre
ALTER TABLE barberia ADD COLUMN descripcion TEXT NOT NULL DEFAULT '';
ALTER TABLE barberia ADD COLUMN mapa_url TEXT;
ALTER TABLE barberia ADD COLUMN instagram TEXT;
ALTER TABLE barberia ADD COLUMN facebook TEXT;
ALTER TABLE barberia ADD COLUMN tiktok TEXT;
UPDATE barberia SET marca_titulo = 'OLIMPO', marca_subtitulo = 'BARBER CLUB' WHERE nombre = 'Olimpo Barber Club';

-- Usuarios que entran con correo: nombre visible
ALTER TABLE usuarios ADD COLUMN nombre TEXT;
