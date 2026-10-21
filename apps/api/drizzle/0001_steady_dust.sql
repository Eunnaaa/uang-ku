CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"institution_code" varchar(20) NOT NULL,
	"masked_account_number" varchar(30),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_id" varchar(100) NOT NULL,
	"amount" bigint NOT NULL,
	"type" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"transaction_time" timestamp with time zone NOT NULL,
	"reconciliation_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"matched_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_mutations_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "chk_bank_mut_amount" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"period" varchar(10) DEFAULT 'monthly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_budget_amount" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"emoji" varchar(10) DEFAULT '🎯',
	"target_amount" bigint NOT NULL,
	"current_amount" bigint DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"target_date" varchar(20),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_goal_target" CHECK (target_amount > 0)
);
--> statement-breakpoint
CREATE TABLE "pockets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"emoji" varchar(10) DEFAULT '💰',
	"type" varchar(20) NOT NULL,
	"allocated_balance" bigint DEFAULT 0 NOT NULL,
	"target_amount" bigint,
	"is_locked" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_pocket_allocated" CHECK (allocated_balance >= 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"type" varchar(20) NOT NULL,
	"amount" bigint NOT NULL,
	"frequency" varchar(20) NOT NULL,
	"note" text,
	"next_due_date" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_recurring_amount" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"template_payload" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "pocket_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_mutations" ADD CONSTRAINT "bank_mutations_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pockets" ADD CONSTRAINT "pockets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pockets" ADD CONSTRAINT "pockets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_templates" ADD CONSTRAINT "transaction_templates_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_conn_user" ON "bank_connections" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_bank_mut_conn_status" ON "bank_mutations" USING btree ("connection_id","reconciliation_status");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_active" ON "budgets" USING btree ("user_id","category_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_goals_user_status" ON "financial_goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_pockets_user_account" ON "pockets" USING btree ("user_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_user_due" ON "recurring_rules" USING btree ("user_id","is_active","next_due_date");--> statement-breakpoint
CREATE INDEX "idx_templates_user_use" ON "transaction_templates" USING btree ("user_id","use_count");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pocket_id_pockets_id_fk" FOREIGN KEY ("pocket_id") REFERENCES "public"."pockets"("id") ON DELETE set null ON UPDATE no action;