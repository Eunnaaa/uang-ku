ALTER TABLE "profiles" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "receipt_url" text;