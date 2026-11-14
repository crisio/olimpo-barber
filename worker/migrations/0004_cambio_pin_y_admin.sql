-- PIN temporal que debe cambiarse al primer ingreso, y personal administrador que no atiende clientes.
ALTER TABLE barberos ADD COLUMN debe_cambiar_pin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE barberos ADD COLUMN atiende INTEGER NOT NULL DEFAULT 1;   -- 0 = solo administra; no aparece para agendar
