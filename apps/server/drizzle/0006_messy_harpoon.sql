CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "blocks_not_self" CHECK ("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_reads" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_message_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_reads_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low" uuid NOT NULL,
	"user_high" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_pair" UNIQUE("user_low","user_high"),
	CONSTRAINT "conversations_order" CHECK ("conversations"."user_low" < "conversations"."user_high")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"kind" text NOT NULL,
	"text" text,
	"couplet_key" text,
	"note" text,
	"payload" jsonb,
	"client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "messages_sender_client" UNIQUE("sender_id","client_id"),
	CONSTRAINT "messages_text_length" CHECK (char_length("messages"."text") <= 1000),
	CONSTRAINT "messages_note_length" CHECK (char_length("messages"."note") <= 200)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_user_id" uuid NOT NULL,
	"message_id" uuid,
	"reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_note_length" CHECK (char_length("reports"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "shared_divan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"divan_id" uuid NOT NULL,
	"key" text NOT NULL,
	"added_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_divan_items_key" UNIQUE("divan_id","key"),
	CONSTRAINT "shared_divan_items_note_length" CHECK (char_length("shared_divan_items"."note") <= 200)
);
--> statement-breakpoint
CREATE TABLE "shared_divan_likes" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "shared_divan_likes_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shared_divans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low" uuid NOT NULL,
	"user_high" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_divans_pair" UNIQUE("user_low","user_high"),
	CONSTRAINT "shared_divans_order" CHECK ("shared_divans"."user_low" < "shared_divans"."user_high")
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_reads" ADD CONSTRAINT "conversation_reads_last_read_message_id_messages_id_fk" FOREIGN KEY ("last_read_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divan_items" ADD CONSTRAINT "shared_divan_items_divan_id_shared_divans_id_fk" FOREIGN KEY ("divan_id") REFERENCES "public"."shared_divans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divan_items" ADD CONSTRAINT "shared_divan_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divan_likes" ADD CONSTRAINT "shared_divan_likes_item_id_shared_divan_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shared_divan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divan_likes" ADD CONSTRAINT "shared_divan_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divans" ADD CONSTRAINT "shared_divans_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_divans" ADD CONSTRAINT "shared_divans_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_blocker_created" ON "blocks" USING btree ("blocker_id","created_at","blocked_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "conversations_high" ON "conversations" USING btree ("user_high");--> statement-breakpoint
CREATE INDEX "messages_conversation_created" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_created" ON "reports" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "shared_divan_items_divan_created" ON "shared_divan_items" USING btree ("divan_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "shared_divans_high" ON "shared_divans" USING btree ("user_high");