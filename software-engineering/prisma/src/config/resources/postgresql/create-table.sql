-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- Aufruf:
-- docker compose exec db bash
-- psql --dbname=auto --username=auto --file=/sql/create-table.sql

-- text statt varchar(n):
-- "There is no performance difference among these three types, apart from a few extra CPU cycles
-- to check the length when storing into a length-constrained column"
-- ggf. CHECK(char_length(fgnr) <= 255)

-- Indexe auflisten:
-- psql --dbname=auto --username=auto
--  SELECT   tablename, indexname, indexdef, tablespace
--  FROM     pg_indexes
--  WHERE    schemaname = 'auto'
--  ORDER BY tablename, indexname;
--  \q

-- https://www.postgresql.org/docs/current/manage-ag-tablespaces.html
SET default_tablespace = autospace;

-- https://www.postgresql.org/docs/current/app-psql.html
-- https://www.postgresql.org/docs/current/ddl-schemas.html
-- "user-private schema" (Default-Schema: public)
CREATE SCHEMA IF NOT EXISTS auto AUTHORIZATION auto;

ALTER ROLE auto SET search_path = 'auto';
SET search_path TO 'auto';

-- ======================================================================
--  ENUM-Typ für Auto-Art
-- ======================================================================
-- https://www.postgresql.org/docs/current/sql-createtype.html
-- https://www.postgresql.org/docs/current/datatype-enum.html
CREATE TYPE autoart AS ENUM ('COUPE', 'LIMO', 'KOMBI');

-- ======================================================================
--  Tabelle AUTO
-- ======================================================================
-- https://www.postgresql.org/docs/current/sql-createtable.html
-- https://www.postgresql.org/docs/current/datatype.html
CREATE TABLE IF NOT EXISTS auto (
    -- https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-INT
    -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-PRIMARY-KEYS
    -- "GENERATED ALWAYS AS IDENTITY" gemaess SQL-Standard
    id            integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,

    version       integer NOT NULL DEFAULT 0,

    -- Fahrgestellnummer, eindeutig
    fgnr          text NOT NULL UNIQUE,

    art           autoart,

    -- 8 Stellen, davon 2 Nachkommastellen (z.B. 44990.00)
    preis         decimal(8,2) NOT NULL,

    -- Rabatt in Prozent (0–100)
    rabatt        integer NOT NULL CHECK (rabatt >= 0 AND rabatt <= 100),

    -- https://www.postgresql.org/docs/current/datatype-boolean.html
    lieferbar     boolean NOT NULL DEFAULT FALSE,

    -- https://www.postgresql.org/docs/current/datatype-datetime.html
    datum         date,

    -- Schlagwoerter als Text-Array (z.B. {SPORT,KOMFORT})
    schlagwoerter text[],

    -- Zeitstempel
    erzeugt       timestamp NOT NULL DEFAULT NOW(),
    aktualisiert  timestamp NOT NULL DEFAULT NOW()
);

-- ======================================================================
--  Tabelle MODELL (1:1 zu AUTO)
-- ======================================================================
CREATE TABLE IF NOT EXISTS modell (
    id          integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    modell      text NOT NULL,
    auto_id     integer NOT NULL UNIQUE REFERENCES auto ON DELETE CASCADE
);

-- ======================================================================
--  Tabelle BILD (n:1 zu AUTO)
-- ======================================================================
CREATE TABLE IF NOT EXISTS bild (
    id              integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    beschriftung    text NOT NULL,
    content_type    text NOT NULL,
    auto_id         integer NOT NULL REFERENCES auto ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bild_auto_id_idx ON bild(auto_id);

-- ======================================================================
--  Tabelle AUTO_FILE (1:1 zu AUTO, Binärdaten)
-- ======================================================================
CREATE TABLE IF NOT EXISTS auto_file (
    id              integer GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    data            bytea NOT NULL,
    filename        text NOT NULL,
    mimetype        text,
    auto_id         integer NOT NULL UNIQUE REFERENCES auto ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auto_file_auto_id_idx ON auto_file(auto_id);
