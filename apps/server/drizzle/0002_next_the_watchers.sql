CREATE TABLE "divan_items" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kept_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	CONSTRAINT "divan_items_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"kept_visibility" text NOT NULL,
	"daily_visibility" text NOT NULL,
	"show_online" boolean NOT NULL,
	"in_global_leaderboard" boolean NOT NULL,
	"messages_from" text NOT NULL,
	"game_invites_from" text NOT NULL,
	"allow_reposts" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar" jsonb;--> statement-breakpoint
ALTER TABLE "divan_items" ADD CONSTRAINT "divan_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;