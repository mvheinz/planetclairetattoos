import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_legal_snippets_key" ADD VALUE 'ip.copyrightNotice';
  ALTER TYPE "public"."enum_legal_snippets_key" ADD VALUE 'ip.aiMiningReservation';
  ALTER TYPE "public"."enum_legal_snippets_key" ADD VALUE 'ip.purchaseClause';
  ALTER TYPE "public"."enum_legal_snippets_key" ADD VALUE 'ip.tattooFlashNotice';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "legal_snippets" ALTER COLUMN "key" SET DATA TYPE text;
  DROP TYPE "public"."enum_legal_snippets_key";
  CREATE TYPE "public"."enum_legal_snippets_key" AS ENUM('price.kleinunternehmerNote', 'price.shippingNote', 'price.tattooNote', 'delivery.timeShipping', 'delivery.timePickup', 'cart.paymentAndDeliveryInfo', 'checkout.legalNotice', 'checkout.dhlEmailConsent', 'checkout.deviationAgreement', 'checkout.vorkasseInfo', 'product.ceramicsDecorative', 'product.ceramicsFoodSafe', 'product.jewelrySmallParts', 'product.jewelryNickel', 'product.textileSecondHand', 'product.textileLabelMissing', 'product.noSpecialWarnings', 'product.glassFrame', 'email.orderConfirmation.contractSentence', 'email.vorkasse.paymentInstructions', 'email.vorkasse.reminder', 'email.vorkasse.cancellation', 'email.shipping.damageNotice', 'email.pickup.ready', 'withdrawal.intro', 'withdrawal.receiptNotice', 'withdrawal.returnInfo', 'withdrawal.returnCostsNote', 'complaint.repairChoice', 'dispute.vsbg37', 'inquiry.privacyNotice', 'inquiry.autoReply', 'commission.offer', 'translation.disclaimer', 'privacyRequest.accessResponse', 'privacyRequest.erasureResponse');
  ALTER TABLE "legal_snippets" ALTER COLUMN "key" SET DATA TYPE "public"."enum_legal_snippets_key" USING "key"::"public"."enum_legal_snippets_key";`)
}
