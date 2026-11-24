ALTER TABLE "users" ADD COLUMN "is_house" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_one_house" ON "users" USING btree ("is_house") WHERE "users"."is_house";--> statement-breakpoint
INSERT INTO "users" ("username", "display_name", "is_house") SELECT 'yebeyt', 'یه بیت', true WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "is_house") ON CONFLICT DO NOTHING;