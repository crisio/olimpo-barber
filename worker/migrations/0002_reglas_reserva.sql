-- Reglas de reserva de Olimpo Barber: anticipación mínima, hora de almuerzo y horario 10 a.m. – 9 p.m.
ALTER TABLE barberia ADD COLUMN anticipacion_min INTEGER NOT NULL DEFAULT 60;   -- se reserva al menos con este tiempo
ALTER TABLE barberia ADD COLUMN almuerzo TEXT DEFAULT '["12:00","13:00"]';      -- JSON [desde, hasta] o NULL
UPDATE barberia SET horario =
 '{"0":null,"1":["10:00","21:00"],"2":["10:00","21:00"],"3":["10:00","21:00"],"4":["10:00","21:00"],"5":["10:00","21:00"],"6":["10:00","21:00"]}';
