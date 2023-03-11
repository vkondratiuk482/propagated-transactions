CREATE USER mokuteki WITH PASSWORD 'pass123';
DROP DATABASE IF EXISTS propagated-test
CREATE DATABASE propagated-test OWNER mokuteki;
