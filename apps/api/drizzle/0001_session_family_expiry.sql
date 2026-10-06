-- Caducidad absoluta de cada familia de sesiones (90 días desde el login). Se añade en tres pasos para no
-- fallar con filas existentes: estas heredan el límite desde la sesión más antigua de su familia.
ALTER TABLE "sessions" ADD COLUMN "family_expires_at" timestamp with time zone;--> statement-breakpoint
UPDATE "sessions" AS s SET "family_expires_at" = f.started_at + interval '90 days' FROM (SELECT "family_id", min("created_at") AS started_at FROM "sessions" GROUP BY "family_id") AS f WHERE s."family_id" = f."family_id";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "family_expires_at" SET NOT NULL;
