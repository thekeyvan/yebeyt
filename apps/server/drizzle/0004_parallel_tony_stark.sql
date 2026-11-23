CREATE TABLE "daily_results" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"solved" boolean NOT NULL,
	"tries" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_results_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "daily_results_tries" CHECK ("daily_results"."tries" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "follows_not_self" CHECK ("follows"."follower_id" <> "follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "league_closures" (
	"week" text PRIMARY KEY NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" text NOT NULL,
	"tier" integer NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_groups_tier" CHECK ("league_groups"."tier" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "league_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week" text NOT NULL,
	CONSTRAINT "league_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id"),
	CONSTRAINT "league_members_user_week" UNIQUE("user_id","week")
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_user_id_key_kind_pk" PRIMARY KEY("user_id","key","kind")
);
--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"game" text NOT NULL,
	"points" integer NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"week" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_events_points" CHECK ("score_events"."points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_tiers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier" integer NOT NULL,
	"from_week" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_results" ADD CONSTRAINT "daily_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_group_id_league_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."league_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_events" ADD CONSTRAINT "score_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tiers" ADD CONSTRAINT "user_tiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_results_user_created" ON "daily_results" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "follows_follower_created" ON "follows" USING btree ("follower_id","created_at","followee_id");--> statement-breakpoint
CREATE INDEX "follows_followee_created" ON "follows" USING btree ("followee_id","created_at","follower_id");--> statement-breakpoint
CREATE INDEX "league_groups_open" ON "league_groups" USING btree ("week","tier","member_count");--> statement-breakpoint
CREATE INDEX "reactions_key_kind" ON "reactions" USING btree ("key","kind");--> statement-breakpoint
CREATE INDEX "reactions_user_created" ON "reactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "score_events_user_week" ON "score_events" USING btree ("user_id","week");--> statement-breakpoint
CREATE INDEX "score_events_week_user" ON "score_events" USING btree ("week","user_id","points");--> statement-breakpoint
CREATE INDEX "users_username_prefix" ON "users" USING btree ("username" text_pattern_ops);