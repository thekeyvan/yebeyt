ALTER TABLE "reports" DROP CONSTRAINT "reports_target_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "target_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "message_kind" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "message_text" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "message_key" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "message_note" text;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_reads_message" ON "conversation_reads" USING btree ("last_read_message_id");--> statement-breakpoint
CREATE INDEX "reports_message" ON "reports" USING btree ("message_id");