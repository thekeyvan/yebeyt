ALTER TABLE "score_events" ADD COLUMN "day" date;--> statement-breakpoint
CREATE UNIQUE INDEX "score_events_daily_once" ON "score_events" USING btree ("user_id","day") WHERE "score_events"."game" = 'daily';--> statement-breakpoint
CREATE UNIQUE INDEX "score_events_onboarding_once" ON "score_events" USING btree ("user_id") WHERE "score_events"."game" = 'onboarding';