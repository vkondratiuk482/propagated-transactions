CREATE USER mokuteki WITH PASSWORD 'pass123';
DROP DATABASE IF EXISTS isolated-test
CREATE DATABASE isolated-test OWNER mokuteki;
