-- https://www.postgresql.org/docs/current/sql-createrole.html
CREATE ROLE auto LOGIN PASSWORD 'p';

-- https://www.postgresql.org/docs/current/sql-createdatabase.html
CREATE DATABASE auto;

GRANT ALL ON DATABASE auto TO auto;

-- https://www.postgresql.org/docs/10/sql-createtablespace.html
CREATE TABLESPACE autospace OWNER auto LOCATION '/var/lib/postgresql/tablespace/auto';