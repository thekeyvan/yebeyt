CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_players_game_id_user_id_pk" PRIMARY KEY("game_id","user_id"),
	CONSTRAINT "game_players_seat" UNIQUE("game_id","seat"),
	CONSTRAINT "game_players_seat_range" CHECK ("game_players"."seat" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"turn_seconds" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"turn_started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"winner_id" uuid,
	"end_reason" text,
	"rounds" jsonb,
	CONSTRAINT "games_code_unique" UNIQUE("code"),
	CONSTRAINT "games_turn_seconds" CHECK ("games"."turn_seconds" in (8, 30, 120, 86400))
);
--> statement-breakpoint
CREATE TABLE "mosh_moves" (
	"game_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"user_id" uuid,
	"key" text NOT NULL,
	"m1" text NOT NULL,
	"m2" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mosh_moves_game_id_n_pk" PRIMARY KEY("game_id","n"),
	CONSTRAINT "mosh_moves_key" UNIQUE("game_id","key")
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosh_moves" ADD CONSTRAINT "mosh_moves_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mosh_moves" ADD CONSTRAINT "mosh_moves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_user" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "games_active_deadline" ON "games" USING btree ("status","kind");