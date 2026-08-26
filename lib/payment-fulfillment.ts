import { getServiceSupabase } from '@/lib/supabase';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { PaymentConfirmationEmail } from '@/components/emails/PaymentConfirmation';
import * as React from 'react';

export interface FulfillmentParams {
  purchaseId?: string;
  transactionId?: string;
  txRef?: string;
  customerEmail: string;
  amountPaid: number;
  referralCode?: string;
}

export interface FulfillmentResult {
  success: boolean;
  message?: string;
  code?: string;
  purchaseId?: string;
}

/**
 * Shared helper to complete payment processing:
 * 1. Mark purchase payment_status & status_update = 'paid'
 * 2. Get/generate book access code from book_codes table
 * 3. Process referral reward if present and not processed
 * 4. Send confirmation email via Nodemailer
 */
export async function processPaymentFulfillment(params: FulfillmentParams): Promise<FulfillmentResult> {
  const supabase = getServiceSupabase();
  const emailLower = params.customerEmail.trim().toLowerCase();
  const txIdentifier = params.transactionId || params.txRef || `deloxe-tx-${Date.now()}`;

  let purchaseId = params.purchaseId;
  let referCode = params.referralCode || '';
  let isRewardProcessed = false;

  // Look up existing purchase if purchaseId is not explicitly provided
  if (!purchaseId && txIdentifier) {
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('id, referrcode, reward_processed, status_update')
      .or(`transaction_id.eq.${txIdentifier},transaction_id.eq.${params.txRef || txIdentifier}`)
      .maybeSingle();

    if (existingPurchase) {
      purchaseId = existingPurchase.id;
      referCode = existingPurchase.referrcode || referCode;
      isRewardProcessed = !!existingPurchase.reward_processed;
    }
  }

  if (purchaseId) {
    // Update existing purchase to paid
    await supabase
      .from('purchases')
      .update({
        status_update: 'paid',
        transaction_id: txIdentifier,
        customer_email: emailLower,
        amount_paid: params.amountPaid,
      })
      .eq('id', purchaseId);
  } else {
    // Insert new purchase
    const { data: newPurchase, error: pErr } = await supabase
      .from('purchases')
      .insert({
        transaction_id: txIdentifier,
        customer_email: emailLower,
        amount_paid: params.amountPaid,
        referrcode: referCode || null,
        status_update: 'paid',
        reward_processed: false,
      })
      .select('id, reward_processed')
      .single();

    if (pErr || !newPurchase) {
      console.error('Error inserting purchase record during fulfillment:', pErr);
      return { success: false, message: 'Database insert purchase error' };
    }
    purchaseId = newPurchase.id;
  }

  // Retrieve or generate access book code
  let bookCode = '';
  const { data: existingCode } = await supabase
    .from('book_codes')
    .select('code_string, code')
    .eq('purchase_id', purchaseId)
    .maybeSingle();

  if (existingCode && (existingCode.code_string || existingCode.code)) {
    bookCode = existingCode.code_string || existingCode.code;
  } else {
    // Generate fallback book code if database trigger didn't generate one
    const p1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const p2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedCode = `DELOXE-${p1}-${p2}`;

    const { data: newCodeData } = await supabase
      .from('book_codes')
      .insert({
        purchase_id: purchaseId,
        code_string: generatedCode,
        code: generatedCode,
        is_used: false,
      })
      .select('code_string')
      .maybeSingle();

    bookCode = newCodeData?.code_string || generatedCode;
  }

  // Process referral reward if referral code exists and hasn't been processed yet
  if (referCode && !isRewardProcessed) {
    try {
      const partnersRef = db.collection('partners');
      const partnerSnapshot = await partnersRef.where('referralCode', '==', referCode).get();

      if (!partnerSnapshot.empty) {
        const partnerDoc = partnerSnapshot.docs[0];
        const partnerData = partnerDoc.data();
        const partnerId = partnerData.partnerId;
        const rewardRate = Number(partnerData.rewardRate) || 0;

        const commsRef = db.collection('partner_commissions');
        const commDocRef = commsRef.doc();

        await commDocRef.set({
          commissionId: commDocRef.id,
          partnerId,
          purchaseId,
          transactionId: txIdentifier,
          email: emailLower,
          amountPaid: params.amountPaid,
          commissionAmount: rewardRate,
          payoutStatus: 'verified',
          createdAt: FieldValue.serverTimestamp(),
        });

        const statsRef = db.collection('partner_stats').doc(partnerId);
        const statsDoc = await statsRef.get();

        if (!statsDoc.exists) {
          await statsRef.set({
            partnerId,
            totalClicks: 0,
            totalPurchases: 1,
            totalCommission: rewardRate,
            balance: rewardRate,
            lastUpdated: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          await statsRef.update({
            totalPurchases: FieldValue.increment(1),
            totalCommission: FieldValue.increment(rewardRate),
            balance: FieldValue.increment(rewardRate),
            lastUpdated: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        await supabase
          .from('purchases')
          .update({ reward_processed: true, status_update: 'paid' })
          .eq('id', purchaseId);
      }
    } catch (fireErr) {
      console.error('Error processing referral reward:', fireErr);
    }
  } else {
    await supabase
      .from('purchases')
      .update({ status_update: 'paid' })
      .eq('id', purchaseId);
  }

  // Send Confirmation Email via Nodemailer
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: parseInt(process.env.SMTP_PORT || '587') === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const ReactDOMServer = (await import('react-dom/server')).default;
      const emailHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PaymentConfirmationEmail, { bookCode })
      );

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Deloxe HR <noreply@deloxehr.com>',
        to: emailLower,
        subject: 'Payment Confirmed — Access Your Portal 🚀',
        html: emailHtml,
      });
      console.log(`Payment confirmation email sent to ${emailLower}`);
    } catch (emailErr) {
      console.error('Error sending confirmation email:', emailErr);
    }
  }

  return {
    success: true,
    code: bookCode,
    purchaseId,
  };
}
