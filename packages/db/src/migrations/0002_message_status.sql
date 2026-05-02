CREATE TYPE "public"."message_status" AS ENUM('queued', 'processing', 'processed', 'failed');
--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "status" "message_status" DEFAULT 'queued' NOT NULL;
