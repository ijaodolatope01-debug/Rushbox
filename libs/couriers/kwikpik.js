import { debug } from "../../handlers/v2/delivery.js";
import update_ongoing_status from "../utils/update_ongoing_status.js";
import crypto from "crypto";

const estimate_kwikpik = async ({ pickup_address, destination_address }) => {
  try {
    let body = {
      // insured: false,
      packages: [
        {
          deliveryAddress: destination_address,
        },
      ],
      pickupAddress: pickup_address,
    };
    debug(body, process.env.KWIKPIK_TOKEN);
    const res = await fetch(
      process.env.STAGING
        ? "https://logistics-sandbox.kwikpik.io/api/v2/orders/estimate"
        : "https://logistics-api.kwikpik.io/api/v2/orders/estimate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.STAGING
            ? process.env.KWIKPIK_TEST_TOKEN
            : process.env.KWIKPIK_TOKEN,
        },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();

    debug(JSON.stringify(data, null, 2), "KWIKPIK");
    if (!data.data) return null;

    return {
      courier: "kwikpik",
      price: data.data.totalEstimatedPrice,
      duration: data.data.totalEstimatedDuration,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
};

async function create_kwikpik(details) {
  let {
    destination_latitude,
    destination_longitude,
    destination_address,
    pickup_latitude,
    pickup_longitude,
    pickup_address,
    sender_name,
    sender_email,
    sender_phone,
    recipient_name,
    recipient_phone,
    package_detail,
    order_name,
    value_of_item,
    package_weight,
    delivery_note,
    recipient_email,
    reference,
  } = details;

  let reply = {};
  let data;

  try {
    let payload = {
      orders: [
        {
          merchantPackageNumber: reference || crypto.randomUUID(),
          pickupAddress: pickup_address,
          pickupLatitude: pickup_latitude,
          pickupLongitude: pickup_longitude,
          pickupContactName: sender_name,
          pickupContactPhone: sender_phone,
          pickupContactEmail: sender_email,
          deliveryAddress: destination_address,
          deliveryLatitude: destination_latitude,
          deliveryLongitude: destination_longitude,
          deliveryContactName: recipient_name,
          deliveryContactPhone: recipient_phone,
          deliveryContactEmail: recipient_email,
          deliveryNotes: delivery_note,
          description: package_detail,
          packageWeightInKg: package_weight,
          quantity: 1,
          packageValue: value_of_item,
          items: [
            {
              name: order_name,
              quantity: 1,
            },
          ],
          metadata: {},
        },
      ],
    };

    const response = await fetch(
      process.env.STAGING
        ? "https://logistics-sandbox.kwikpik.io/api/v2/orders/unified"
        : "https://logistics-api.kwikpik.io/api/v2/orders/unified",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.STAGING
            ? process.env.KWIKPIK_TEST_TOKEN
            : process.env.KWIKPIK_TOKEN,
        },
        body: JSON.stringify(payload),
      },
    );

    data = await response.json();

    data = data?.data;
    debug(JSON.stringify(data, null, 2), "kpk");

    if (data.successful) {
      reply.courier_key = data?.successful?.[0].packageInformation?.trackingId;
      reply.courier_response = data?.result;
    }
  } catch (error) {
    console.error("Error initiating delivery:", error);
  }

  return reply;
}

const webhook_kwikpik = async (req, { staging }) => {
  try {
    console.log("========== KWIKPIK WEBHOOK START ==========");

    const signatureHeader = req.headers?.["x-kwikpik-signature"];

    if (!signatureHeader) {
      console.log("[KWIKPIK] Missing signature header");
      return false;
    }

    /*
     * ---------------------------------------------------------
     * PARSE SIGNATURE
     *
     * t=<unix-seconds>,v1=<hex>
     * ---------------------------------------------------------
     */

    const parts = Object.fromEntries(
      signatureHeader.split(",").map((part) => {
        const [key, ...value] = part.split("=");
        return [key?.trim(), value.join("=").trim()];
      }),
    );

    const timestamp = parts.t;
    const signature = parts.v1;

    console.log("[KWIKPIK] timestamp:", timestamp);
    console.log("[KWIKPIK] signature:", signature);

    if (!timestamp || !signature) {
      console.log("[KWIKPIK] Invalid signature format");

      return false;
    }

    /*
     * ---------------------------------------------------------
     * TIMESTAMP VALIDATION
     * ---------------------------------------------------------
     */

    const timestampNumber = Number.parseInt(timestamp, 10);

    if (!Number.isFinite(timestampNumber)) {
      console.log("[KWIKPIK] Invalid timestamp");

      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    const difference = Math.abs(now - timestampNumber);

    console.log("[KWIKPIK] Timestamp difference:", difference);

    if (difference > 300) {
      console.log("[KWIKPIK] Stale webhook");

      return false;
    }

    /*
     * ---------------------------------------------------------
     * WEBHOOK SECRET
     *
     * This MUST be the Kwikpik webhook signing secret.
     * It is not necessarily the API token.
     * ---------------------------------------------------------
     */

    const secret = staging
      ? process.env.KWIKPIK_WEBHOOK_SECRET_TEST
      : process.env.KWIKPIK_WEBHOOK_SECRET;

    if (!secret) {
      console.log("[KWIKPIK] Webhook signing secret is not configured");

      return false;
    }

    /*
     * ---------------------------------------------------------
     * RAW BODY
     *
     * NEVER use JSON.stringify(req.body).
     *
     * Kwikpik signs the exact raw HTTP body.
     * ---------------------------------------------------------
     */

    const rawBody = req.raw_body;

    if (typeof rawBody !== "string") {
      console.log("[KWIKPIK] Raw request body unavailable");

      return false;
    }

    console.log("[KWIKPIK] Raw body:", rawBody);

    /*
     * ---------------------------------------------------------
     * SIGNATURE
     *
     * HMAC-SHA256(
     *   secret,
     *   `${timestamp}.${rawBody}`
     * )
     * ---------------------------------------------------------
     */

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature, "hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    console.log(
      "[KWIKPIK] Signature lengths:",
      receivedBuffer.length,
      expectedBuffer.length,
    );

    if (receivedBuffer.length !== expectedBuffer.length) {
      console.log("[KWIKPIK] Signature length mismatch");

      return false;
    }

    const valid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

    console.log("[KWIKPIK] Signature valid:", valid);

    if (!valid) {
      console.log("[KWIKPIK] Signature validation failed");

      return false;
    }

    console.log("[KWIKPIK] Signature validation passed");

    /*
     * ---------------------------------------------------------
     * PAYLOAD
     * ---------------------------------------------------------
     */

    const payload = req.body || {};

    console.log("[KWIKPIK] Event:", payload.event);

    console.log("[KWIKPIK] Webhook ID:", req.headers?.["x-kwikpik-webhook-id"]);

    console.log("[KWIKPIK] Payload:", JSON.stringify(payload, null, 2));

    /*
     * ---------------------------------------------------------
     * ORDER EVENT
     * ---------------------------------------------------------
     */

    const status = payload.status || payload.data?.status;

    const request_id =
      payload.requestId || payload.data?.trackingId || payload.data?.requestId;

    /*
     * order.created currently contains:
     *
     * data.orderRef
     * data.orderCode
     *
     * but no status/trackingId.
     *
     * It is still a valid authenticated webhook, so
     * acknowledge it instead of treating it as invalid.
     */

    if (!status) {
      console.log("[KWIKPIK] No status on event:", payload.event);

      console.log("========== KWIKPIK WEBHOOK END ==========");

      return true;
    }

    if (!request_id) {
      console.log("[KWIKPIK] Missing request ID");

      return false;
    }

    if (!req.db) {
      console.log("[KWIKPIK] Database unavailable");

      return false;
    }

    /*
     * ---------------------------------------------------------
     * UPDATE ORDER
     * ---------------------------------------------------------
     */

    const result = await update_ongoing_status(request_id, status, "kwikpik", {
      db: req.db,
    });

    console.log("[KWIKPIK] Update result:", result);

    console.log("========== KWIKPIK WEBHOOK END ==========");

    return result;
  } catch (error) {
    console.error("[KWIKPIK] Fatal webhook error:", error);

    console.log("========== KWIKPIK WEBHOOK END ==========");

    return false;
  }
};

export { estimate_kwikpik, create_kwikpik, webhook_kwikpik };
