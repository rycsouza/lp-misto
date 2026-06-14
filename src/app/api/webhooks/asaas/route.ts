import { NextRequest, NextResponse } from "next/server";
import {
  activateMemberBySubscription,
  cancelMemberBySubscription,
} from "@/app/actions/membership";

// Asaas sends the webhook token in the "asaas-access-token" header.
// Configure ASAAS_WEBHOOK_TOKEN in .env.local to match the value set in your Asaas account.
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify token if configured
  if (WEBHOOK_TOKEN) {
    const incomingToken = req.headers.get("asaas-access-token") ?? "";
    if (incomingToken !== WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const payment = body.payment as
    | { subscription?: string; status?: string }
    | undefined;

  if (!event || !payment) {
    return NextResponse.json({ received: true });
  }

  const subscriptionId = payment.subscription;

  try {
    switch (event) {
      // Payment confirmed → activate member
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        if (subscriptionId) {
          await activateMemberBySubscription(subscriptionId);
        }
        break;

      // Subscription cancelled or chargebacked → cancel member
      case "SUBSCRIPTION_CANCELLED":
      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "PAYMENT_REFUNDED":
        if (subscriptionId) {
          await cancelMemberBySubscription(subscriptionId);
        }
        break;

      default:
        // PAYMENT_OVERDUE, PAYMENT_CREATED, etc. — no action needed
        break;
    }
  } catch (err) {
    console.error("Asaas webhook processing error:", err);
    // Return 200 so Asaas doesn't retry; log the error server-side
  }

  return NextResponse.json({ received: true });
}
