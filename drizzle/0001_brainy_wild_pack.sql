ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
UPDATE "user" u
SET "stripe_customer_id" = s."stripe_customer_id"
FROM "subscriptions" s
WHERE s."user_id" = u."id" AND s."stripe_customer_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "cancel_at_period_end";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_stripe_customer_id_unique" UNIQUE("stripe_customer_id");
