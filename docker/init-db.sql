-- One-time database initialization for Docker environment
CREATE ROLE app_readwrite NOLOGIN;
CREATE ROLE ledger_append_only NOLOGIN;

CREATE USER backend_app WITH LOGIN PASSWORD 'backend_app_secure_password_2026';
GRANT app_readwrite TO backend_app;
GRANT ledger_append_only TO backend_app;

GRANT CONNECT ON DATABASE gem_compliance TO backend_app;
GRANT USAGE ON SCHEMA public TO app_readwrite, ledger_append_only;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_readwrite;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO app_readwrite;
