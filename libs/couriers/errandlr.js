import { debug } from "../../handlers/v2/delivery.js";
import update_ongoing_status from "../utils/update_ongoing_status.js";
import crypto from "crypto"; // added import

const estimate_errandlr = async ({ pickup_address, destination_address }) => {
  try {
    const response = await fetch(
      process.env.STAGING
        ? "https://green.errandlr.com/v2/estimate"
        : "https://commerce.errandlr.com/v2/estimate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.STAGING ? process.env.ERRANDLR_TEST_TOKEN : process.env.ERRANDLR_TOKEN}`,
        },
        body: JSON.stringify({
          dropoffLocations: [
            { id: destination_address, label: destination_address },
          ],
          pickupLocation: { id: pickup_address, label: pickup_address },
        }),
      },
    );

    const data = await response.json();

    debug(data, "errandlr");
    if (data.status === "success") {
      return {
        courier: "errandlr",
        price: data.estimate,
        duration: data.estimateLabel,
        meta: { geoid: data.geoId },
      };
    }
  } catch (e) {
    console.log(e, "errand");
  }

  return null;
};

async function create_errandlr(details) {
  let {
    geoid,
    sender_name,
    sender_email,
    sender_phone,
    destination_latitude,
    destination_longitude,
    pickup_notes,
    order_name,
    order_number,
    recipient_phone,
    package_detail,
    delivery_notes,
    destination_state,
    destination_country,
    destination_city,
    local_govt,
  } = details;

  let reply = {};
  let data;

  try {
    const response = await fetch(
      process.env.STAGING
        ? "https://green.errandlr.com/request"
        : "https://commerce.errandlr.com/request",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.STAGING ? process.env.ERRANDLR_TEST_TOKEN : process.env.ERRANDLR_TOKEN}`,
        },
        body: JSON.stringify({
          geoId: geoid,
          name: sender_name,
          email: sender_email,
          phone: sender_phone,
          latitude: destination_latitude,
          longitude: destination_longitude,
          pickupNotes: pickup_notes,
          deliverToInformation: [
            {
              order: 1,
              name: order_name,
              phone: recipient_phone,
              packageDetail: package_detail,
              deliveryNotes: delivery_notes,
            },
          ],
          state: destination_state,
          country: destination_country,
          city: destination_city,
          localGovt: local_govt,
        }),
      },
    );

    data = await response.json();
    console.log(data);

    if (data?.status === 200) {
      reply.courier_key = data?.trackingId;
      reply.courier_response = data;
    }
  } catch (error) {
    console.error(error);
  }

  return reply;
}

const webhook_errandlr = async (req, { staging }) => {
  let { db } = req;
  console.log("========== ERRANDLR WEBHOOK START ==========");

  console.log("[ERRANDLR] Headers:", req.headers);
  console.log("[ERRANDLR] Body:", req.body);

  const received_signature = req.headers["x-errandlr-signature"];

  console.log("[ERRANDLR] Received signature:", received_signature);

  const hash = crypto
    .createHmac(
      "sha512",
      staging ? process.env.ERRANDLR_TEST_TOKEN : process.env.ERRANDLR_TOKEN,
    )
    .update(JSON.stringify(req.body))
    .digest("hex");

  console.log("[ERRANDLR] Generated hash:", hash);
  console.log("[ERRANDLR] Signature match:", hash === received_signature);

  if (hash != received_signature) {
    console.log("[ERRANDLR] Invalid webhook signature");
    console.log("========== ERRANDLR WEBHOOK END ==========");

    return false;
  }

  console.log("[ERRANDLR] Webhook signature verified");

  // Retrieve the request's body
  const event = req.body;

  console.log("[ERRANDLR] Event:", event);

  let { status, data } = event;

  console.log("[ERRANDLR] Status:", status);
  console.log("[ERRANDLR] Data:", data);

  let id = data?.tracking?.[0]?.trackingId;

  console.log("[ERRANDLR] Tracking ID:", id);

  const status_parts = status?.split(".");
  console.log("[ERRANDLR] Status parts:", status_parts);

  const ongoing_status = status_parts?.[1];

  console.log("[ERRANDLR] Ongoing status:", ongoing_status);

  console.log("[ERRANDLR] Updating ongoing status...");

  try {
    const result = await update_ongoing_status(id, ongoing_status, "errandlr", {
      db,
    });

    console.log("[ERRANDLR] update_ongoing_status result:", result);

    console.log("========== ERRANDLR WEBHOOK END ==========");

    return result;
  } catch (error) {
    console.error("[ERRANDLR] update_ongoing_status error:", error);

    console.log("========== ERRANDLR WEBHOOK END ==========");

    return false;
  }
};

export { estimate_errandlr, create_errandlr, webhook_errandlr };
