DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bank_mutations m JOIN bank_connections c ON c.id=m.connection_id
      JOIN transactions t ON t.id=m.matched_transaction_id
      WHERE c.user_id<>t.user_id OR c.account_id<>t.account_id OR m.reconciliation_status NOT IN ('matched','created_as_new')
  ) OR EXISTS (
    SELECT 1 FROM bank_mutations WHERE matched_transaction_id IS NOT NULL
      GROUP BY matched_transaction_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Reconcile historical bank links before applying 0006; no rows were changed.';
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION check_bank_link_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.matched_transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM bank_connections c JOIN transactions t ON t.user_id=c.user_id AND t.account_id=c.account_id
    WHERE c.id=NEW.connection_id AND t.id=NEW.matched_transaction_id
  ) THEN RAISE EXCEPTION 'Incompatible bank link' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bank_link_owner BEFORE INSERT OR UPDATE OF connection_id,matched_transaction_id ON bank_mutations
  FOR EACH ROW EXECUTE FUNCTION check_bank_link_owner();
--> statement-breakpoint
CREATE TABLE "rate_windows" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pocket_members" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pockets" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_windows_expiry" ON "rate_windows" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_owner_expiry" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_mut_verified_transaction" ON "bank_mutations" USING btree ("matched_transaction_id") WHERE reconciliation_status in ('matched','created_as_new');--> statement-breakpoint
ALTER TABLE "bank_mutations" ADD CONSTRAINT "chk_bank_mut_link_state" CHECK (matched_transaction_id is null or reconciliation_status in ('matched','created_as_new'));