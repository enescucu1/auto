-- drop-table.sql für das AUTO-Projekt

-- Aufruf:
-- docker compose exec db bash
-- psql --dbname=auto --username=postgres --file=/sql/drop-table.sql

SET search_path TO auto;

DROP TABLE IF EXISTS auto_file CASCADE;
DROP TABLE IF EXISTS bild CASCADE;
DROP TABLE IF EXISTS modell CASCADE;
DROP TABLE IF EXISTS auto CASCADE;
DROP TYPE IF EXISTS autoart;
