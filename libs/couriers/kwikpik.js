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

    console.log("[KWIKPIK] staging:", staging);
    console.log("[KWIKPIK] signature header:", signatureHeader);

    if (!signatureHeader || typeof signatureHeader !== "string") {
      console.log("[KWIKPIK] missing signature header");
      return false;
    }

    const parts = signatureHeader.split(",");

    const timestampPart = parts.find((part) => part.trim().startsWith("t="));

    const signaturePart = parts.find((part) => part.trim().startsWith("v1="));

    if (!timestampPart || !signaturePart) {
      console.log("[KWIKPIK] invalid signature format");
      console.log("[KWIKPIK] timestamp part:", timestampPart);
      console.log("[KWIKPIK] signature part:", signaturePart);
      return false;
    }

    const timestamp = timestampPart.trim().split("=")[1];
    const signature = signaturePart.trim().split("=")[1];

    if (!timestamp || !signature) {
      console.log("[KWIKPIK] missing timestamp or signature");
      return false;
    }

    const timestampNumber = Number(timestamp);

    if (!Number.isFinite(timestampNumber)) {
      console.log("[KWIKPIK] invalid timestamp:", timestamp);
      return false;
    }

    // Check timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const timestampDifference = Math.abs(now - timestampNumber);

    console.log("[KWIKPIK] current timestamp:", now);
    console.log("[KWIKPIK] webhook timestamp:", timestampNumber);
    console.log("[KWIKPIK] timestamp difference:", timestampDifference);

    if (timestampDifference > 300) {
      console.log("[KWIKPIK] timestamp validation failed");
      return false;
    }

    const secret = staging
      ? process.env.KWIKPIK_TEST_TOKEN
      : process.env.KWIKPIK_TOKEN;

    if (!secret) {
      console.log("[KWIKPIK] webhook secret is not configured");
      return false;
    }

    const payload = req.body || {};

    console.log("[KWIKPIK] payload:", JSON.stringify(payload, null, 2));

    /*
     * Kwikpik signature:
     *
     * HMAC-SHA256(
     *   secret,
     *   `${timestamp}.${JSON.stringify(payload)}`
     * )
     */
    const signingString = `${timestamp}.${JSON.stringify(payload)}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signingString)
      .digest("hex");

    console.log("[KWIKPIK] received signature:", signature);
    console.log("[KWIKPIK] expected signature:", expectedSignature);

    if (signature.length !== expectedSignature.length) {
      console.log("[KWIKPIK] signature length mismatch");
      return false;
    }

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8"),
    );

    console.log("[KWIKPIK] signature valid:", valid);

    if (!valid) {
      console.log("[KWIKPIK] signature validation failed");
      return false;
    }

    console.log("[KWIKPIK] signature validation passed");

    /*
     * Extract order information.
     *
     * Kwikpik can send different event structures, so support
     * the known status/request ID locations.
     */
    console.log(payload.event);
    const status = payload.event?.split(".")?.[1];

    const request_id = payload.data?.orderRef;

    console.log("[KWIKPIK] event:", payload.event);
    console.log("[KWIKPIK] status:", status);
    console.log("[KWIKPIK] request_id:", request_id);

    /*
     * order.created does not contain a delivery status or
     * request/tracking ID in the payload you showed.
     *
     * It is therefore authenticated successfully but there is
     * nothing to update in Ongoing yet.
     */
    if (!status) {
      console.log("[KWIKPIK] missing status");
      console.log("[KWIKPIK] event does not contain a status; ignoring event");

      return true;
    }

    if (!request_id) {
      console.log("[KWIKPIK] missing request_id");
      return false;
    }

    if (!req.db) {
      console.log("[KWIKPIK] database unavailable");
      return false;
    }

    const result = await update_ongoing_status(request_id, status, "kwikpik", {
      db: req.db,
      prop_type: "order_reference",
    });

    console.log("[KWIKPIK] update result:", result);
    console.log("========== KWIKPIK WEBHOOK END ==========");

    return result;
  } catch (error) {
    console.error("[KWIKPIK] fatal webhook error:", error);
    console.log("========== KWIKPIK WEBHOOK END ==========");

    return false;
  }
};

export { estimate_kwikpik, create_kwikpik, webhook_kwikpik };
