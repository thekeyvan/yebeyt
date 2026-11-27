ALTER TABLE "identities" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "news_opt_in_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "identities_email" ON "identities" USING btree ("email");