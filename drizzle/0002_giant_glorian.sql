CREATE TABLE "expense_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "expense_sessions" ("name") VALUES ('Default session');--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "session_id" integer;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "session_id" integer;--> statement-breakpoint
UPDATE "expenses" SET "session_id" = (SELECT "id" FROM "expense_sessions" WHERE "name" = 'Default session' ORDER BY "id" LIMIT 1);--> statement-breakpoint
UPDATE "people" SET "session_id" = (SELECT "id" FROM "expense_sessions" WHERE "name" = 'Default session' ORDER BY "id" LIMIT 1);--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_session_id_expense_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."expense_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_session_id_expense_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."expense_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_session_id_idx" ON "expenses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "people_session_id_idx" ON "people" USING btree ("session_id");
