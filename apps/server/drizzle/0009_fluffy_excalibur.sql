CREATE TABLE "challenge_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text,
	"score" integer NOT NULL,
	"seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_results_user" UNIQUE("challenge_id","user_id"),
	CONSTRAINT "challenge_results_score" CHECK ("challenge_results"."score" between 0 and 10),
	CONSTRAINT "challenge_results_who" CHECK ("challenge_results"."user_id" is not null or "challenge_results"."name" is not null),
	CONSTRAINT "challenge_results_name_length" CHECK (char_length("challenge_results"."name") <= 30)
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"game" text NOT NULL,
	"creator_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"score" integer NOT NULL,
	"seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "challenges_code_unique" UNIQUE("code"),
	CONSTRAINT "challenges_score" CHECK ("challenges"."score" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "challenge_results" ADD CONSTRAINT "challenge_results_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_results" ADD CONSTRAINT "challenge_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_results_user_idx" ON "challenge_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "challenges_creator_created" ON "challenges" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "challenges_expires" ON "challenges" USING btree ("expires_at");