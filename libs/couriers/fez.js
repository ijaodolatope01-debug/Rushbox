import { debug } from "../../handlers/v2/delivery.js";
import { authenticate_fez } from "../utils/couriers.js";

let estimate_fez = async ({
  package_weight,
  pickup_state,
  destination_state,
}) => {
  try {
    let auth = await authenticate_fez();

    let res = await fetch(
      process.env.STAGING
        ? "https://apisandbox.fezdelivery.co/v1/order/cost"
        : "https://api.fezdelivery.co/v1/order/cost",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.authDetails.authToken}`,
          "secret-key": process.env.STAGING
            ? process.env.FEZ_TEST_TOKEN
            : process.env.FEZ_TOKEN,
        },
        body: JSON.stringify({
          weight: package_weight,
          pickUpState: pickup_state,
          state: destination_state,
        }),
      },
    );

    let data = await res.json();
    console.log(data);
    if (data.status !== "Success") return null;

    return {
      courier: "fez",
      price: data.totalCost,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
};

async function create_fez(details) {
  let {
    destination_address,
    destination_state,
    recipient_name,
    recipient_phone,
    reference,
    value_of_item,
    package_weight,
    package_detail,
    pickup_state,
    pickup_address,
  } = details;

  debug({
    destination_address,
    destination_state,
    recipient_name,
    recipient_phone,
    reference,
    value_of_item,
    package_weight,
    package_detail,
    pickup_state,
    pickup_address,
  });
  let reply = {};
  let data;

  reference = reference || crypto.randomUUID();

  try {
    let auth = await authenticate_fez();

    let response = await fetch(
      process.env.STAGING
        ? "https://apisandbox.fezdelivery.co/v1/order"
        : "https://api.fezdelivery.co/v1/order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.authDetails.authToken}`,
          "secret-key": process.env.STAGING
            ? process.env.FEZ_TEST_TOKEN
            : process.env.FEZ_TOKEN,
        },
        body: JSON.stringify([
          {
            recipientAddress: destination_address,
            recipientState: destination_state,
            recipientName: recipient_name,
            recipientPhone: recipient_phone,
            uniqueID: reference,
            BatchID: reference,
            valueOfItem: value_of_item,
            weight: package_weight,
            additionalDetails: package_detail,
            pickUpState: pickup_state,
            pickUpAddress: pickup_address,
          },
        ]),
      },
    );

    data = await response.json();

    debug("[Fez Response]", data);
    if (data.status === "Success") {
      reply.courier_response = data;
      reply.courier_key = data.orderNos[reference];
    } else {
      reply.message = Object.values(data.orderNos)[0];
    }
  } catch (error) {
    console.error("Error:", error);
  }

  return reply;
}

const webhook_fez = async (req, { staging, db }) => {
  console.log("========== FEZ WEBHOOK START ==========");

  console.log("[FEZ] Staging:", staging);
  console.log("[FEZ] Headers:", req.headers);
  console.log("[FEZ] Body:", req.body);

  const { orderNumber, status } = req.body || {};

  const timestamp = req.headers["x-timestamp"];
  const caller_domain = req.headers["x-caller-domain"];
  const received_signature = req.headers["x-signature"];

  console.log("[FEZ] Order number:", orderNumber);
  console.log("[FEZ] Status:", status);
  console.log("[FEZ] Timestamp:", timestamp);
  console.log("[FEZ] Caller domain:", caller_domain);
  console.log("[FEZ] Received signature:", received_signature);

  if (!orderNumber || !status || !timestamp || !received_signature) {
    console.log("[FEZ] Missing required webhook fields");

    console.log("========== FEZ WEBHOOK END ==========");

    return false;
  }

  // --------------------------------------------------
  // SIGNATURE
  // --------------------------------------------------

  const signing_payload = `${orderNumber}${status}${timestamp}`;

  console.log("[FEZ] Signing payload:", signing_payload);

  const hash = crypto
    .createHmac(
      "sha256",
      staging ? process.env.FEZ_TEST_TOKEN : process.env.FEZ_TOKEN,
    )
    .update(signing_payload)
    .digest("hex");

  console.log("[FEZ] Generated signature:", hash);

  console.log("[FEZ] Received signature:", received_signature);

  const signature_valid = hash === received_signature;

  console.log("[FEZ] Signature valid:", signature_valid);

  if (!signature_valid) {
    console.log("[FEZ] Invalid webhook signature");

    console.log("========== FEZ WEBHOOK END ==========");

    return false;
  }

  // --------------------------------------------------
  // TIMESTAMP
  // --------------------------------------------------

  const webhook_timestamp = Number(timestamp);

  const now = Math.floor(Date.now() / 1000);

  console.log("[FEZ] Webhook timestamp:", webhook_timestamp);

  console.log("[FEZ] Current timestamp:", now);

  // Optional replay protection.
  // Allow a 5-minute clock difference.
  const timestamp_difference = Math.abs(now - webhook_timestamp);

  console.log("[FEZ] Timestamp difference:", timestamp_difference);

  if (!Number.isFinite(webhook_timestamp) || timestamp_difference > 300) {
    console.log("[FEZ] Webhook timestamp expired");

    console.log("========== FEZ WEBHOOK END ==========");

    return false;
  }

  // --------------------------------------------------
  // UPDATE ORDER
  // --------------------------------------------------

  console.log("[FEZ] Updating ongoing order status...");

  try {
    const result = await update_ongoing_status(orderNumber, status, "fez", {
      db,
    });

    console.log("[FEZ] update_ongoing_status result:", result);

    console.log("========== FEZ WEBHOOK END ==========");

    return result;
  } catch (error) {
    console.error("[FEZ] update_ongoing_status error:", error);

    console.log("========== FEZ WEBHOOK END ==========");

    return false;
  }
};

export { estimate_fez, create_fez, webhook_fez };
