-- Un barbero puede ser administrador: entra con su PIN (de 6 números) y ve el panel del dueño.
ALTER TABLE barberos ADD COLUMN es_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE barberos ADD COLUMN pin_digitos INTEGER NOT NULL DEFAULT 4;
