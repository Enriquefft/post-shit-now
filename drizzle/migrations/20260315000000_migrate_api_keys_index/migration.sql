-- Drop old unique index on (userId, service) and create new one on (userId, service, keyName)
-- This allows multiple keys per service (e.g., client_id + client_secret for platform credentials)
DROP INDEX IF EXISTS "api_keys_user_service_idx";
CREATE UNIQUE INDEX "api_keys_user_service_key_idx" ON "api_keys" ("user_id", "service", "key_name");
