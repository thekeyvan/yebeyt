ALTER TABLE "games" DROP CONSTRAINT "games_code_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "games_code_open" ON "games" USING btree ("code") WHERE "games"."status" <> 'done';