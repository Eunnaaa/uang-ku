ALTER TABLE "accounts" ADD COLUMN "reserved_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "color" varchar(20) DEFAULT '#D4AF37' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;