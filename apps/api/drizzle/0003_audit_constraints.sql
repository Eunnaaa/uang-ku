CREATE TABLE "pocket_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pocket_id" uuid NOT NULL,
	"member_id" uuid,
	"member_name" varchar(50) NOT NULL,
	"member_avatar" varchar(20) DEFAULT 'user',
	"amount" bigint NOT NULL,
	"note" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pocket_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pocket_id" uuid NOT NULL,
	"user_id" uuid,
	"name" varchar(50) NOT NULL,
	"avatar_emoji" varchar(20) DEFAULT 'user',
	"role" varchar(20) DEFAULT 'contributor' NOT NULL,
	"total_contributed" bigint DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_goals" ALTER COLUMN "emoji" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "financial_goals" ALTER COLUMN "emoji" SET DEFAULT 'target';--> statement-breakpoint
ALTER TABLE "pockets" ALTER COLUMN "emoji" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "pockets" ALTER COLUMN "emoji" SET DEFAULT 'wallet';--> statement-breakpoint
ALTER TABLE "pockets" ADD COLUMN "is_shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pockets" ADD COLUMN "invite_code" varchar(20);--> statement-breakpoint
ALTER TABLE "pocket_contributions" ADD CONSTRAINT "pocket_contributions_pocket_id_pockets_id_fk" FOREIGN KEY ("pocket_id") REFERENCES "public"."pockets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_contributions" ADD CONSTRAINT "pocket_contributions_member_id_pocket_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."pocket_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_members" ADD CONSTRAINT "pocket_members_pocket_id_pockets_id_fk" FOREIGN KEY ("pocket_id") REFERENCES "public"."pockets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pocket_members" ADD CONSTRAINT "pocket_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pocket_contrib_pocket" ON "pocket_contributions" USING btree ("pocket_id");--> statement-breakpoint
CREATE INDEX "idx_pocket_members_pocket" ON "pocket_members" USING btree ("pocket_id");--> statement-breakpoint
CREATE INDEX "idx_pockets_invite_code" ON "pockets" USING btree ("invite_code");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_email_unique" UNIQUE("email");