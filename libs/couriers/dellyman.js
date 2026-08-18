import { debug } from "../../handlers/v2/delivery.js";
import { thirty_mins } from "../estimates.js";
import crypto from "crypto";
import update_ongoing_status from "../utils/update_ongoing_status.js";

let estimate_dellyman = async ({ pickup_address, destination_address }) => {
  try {
    let res = await fetch(
      process.env.STAGING
        ? "https://dev.dellyman.com/api/v3.0/GetQuotes"
        : "https://dellyman.com/api/v3.0/GetQuotes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.STAGING ? process.env.DELLYMAN_TEST_TOKEN : process.env.DELLYMAN_TOKEN}`,
        },
        body: JSON.stringify({
          PaymentMode: "online",
          Vehicle: "Bike",
          PickupRequestedTime: thirty_mins(),
          PickupRequestedDate: new Date().toLocaleDateString(),
          PickupAddress: pickup_address,
          DeliveryAddress: [destination_address],
        }),
      },
    );

    let data = await res.json();
    debug(data, "delly mom");

    if (data.ResponseMessage !== "Success") return null;

    return {
      courier: "dellyman",
      price: data.Companies[0]?.TotalPrice,
      duration: "Next day",
    };
  } catch (e) {
    debug(e);
    debug(9886517674);
    return null;
  }
};

async function create_dellyman(details) {
  let {
    reference,
    company_id,
    sender_name,
    sender_phone,
    pickup_address,
    recipient_name,
    recipient_phone,
    package_weight,
    destination_address,
    delivery_landmark,
    value_of_item,
    package_detail,
  } = details;

  let reply = {};
  let data;

  reference = reference || crypto.randomUUID();

  try {
    const payload = {
      OrderRef: reference,
      CompanyID: 643,
      PaymentMode: "online",
      Vehicle: "Bike",

      PickUpContactName: sender_name,
      PickUpContactNumber: "0".concat(sender_phone.slice(4)),
      PickUpGooglePlaceAddress: pickup_address,
      PickUpLandmark: "N/A",

      IsProductOrder: 0,
      IsInstantDelivery: 0,

      PickUpRequestedDate:
        new Date().getFullYear() +
        "/" +
        String(new Date().getMonth() + 1).padStart(2, "0") +
        "/" +
        String(new Date().getDate()).padStart(2, "0"),

      PickUpRequestedTime: thirty_mins(),
      DeliveryRequestedTime: thirty_mins(),

      DeliveryTimeline: "sameDay",

      Packages: [
        {
          PackageDescription: package_detail,
          DeliveryContactName: recipient_name,
          DeliveryContactNumber: "0".concat(recipient_phone.slice(4)),
          PackageWeight: package_weight,
          DeliveryGooglePlaceAddress: destination_address,
          DeliveryLandmark: delivery_landmark || destination_address,
          ProductAmount: value_of_item,
        },
      ],
    };

    debug("Dellyman request:", payload);

    const res = await fetch(
      process.env.STAGING
        ? "https://dev.dellyman.com/api/v3.0/BookOrder"
        : "https://dellyman.com/api/v3.0/BookOrder",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.STAGING ? process.env.DELLYMAN_TEST_TOKEN : process.env.DELLYMAN_TOKEN}`,
        },

        body: JSON.stringify(payload),
      },
    );

    const responseText = await res.text();

    debug("Dellyman raw response:", responseText);

    const jsonStart = responseText.indexOf("{");

    if (jsonStart === -1) {
      console.error("Dellyman did not return JSON:", responseText);
      return reply;
    }

    try {
      data = JSON.parse(responseText.slice(jsonStart));
    } catch (error) {
      console.error("Failed to parse Dellyman response:", error);
      return reply;
    }

    debug("Dellyman data:", data);

    if (data.ResponseMessage === "Success") {
      reply.courier_key = data.OrderID;
      reply.courier_response = data;

      debug("Dellyman parsed response:", data);
    } else {
      console.error("Dellyman order failed:", data);
    }
  } catch (e) {
    console.error("create_dellyman error:", e);
  }

  return reply;
}

let webhook_dellyman = async (req, { staging }) => {
  console.log("========== DELLYMAN WEBHOOK START ==========");

  console.log("[DELLYMAN] Staging:", staging);
  console.log("[DELLYMAN] Headers:", req.headers);
  console.log("[DELLYMAN] Body:", req.body);

  const token = staging
    ? process.env.DELLYMAN_WEBHOOK_SECRET_TEST
    : process.env.DELLYMAN_WEBHOOK_SECRET;

  console.log("[DELLYMAN] Token configured:", !!token);

  let hash = crypto
    .createHmac("sha256", token)
    .update(JSON.stringify(req.body))
    .digest("hex");

  console.log("[DELLYMAN] Generated signature:", hash);

  const received_signature =
    req.headers["X-Dellyman-Signature"] || req.headers["x-dellyman-signature"];

  console.log("[DELLYMAN] Received signature:", received_signature);

  console.log("[DELLYMAN] Signature valid:", hash === received_signature);

  let event = req.body;

  console.log("[DELLYMAN] Event:", event);

  let { status, order } = event;

  console.log("[DELLYMAN] Status:", status);

  console.log("[DELLYMAN] Order:", order);

  if (!status) {
    console.log("[DELLYMAN] Missing status");

    console.log("========== DELLYMAN WEBHOOK END ==========");

    return false;
  }

  if (hash != received_signature) {
    console.log("[DELLYMAN] Invalid signature");

    console.log("========== DELLYMAN WEBHOOK END ==========");

    return false;
  }

  let id = order?.OrderID;

  console.log("[DELLYMAN] Order ID:", id);

  console.log("[DELLYMAN] Order status:", order?.OrderStatus);

  if (!id) {
    console.log("[DELLYMAN] Missing OrderID");

    console.log("========== DELLYMAN WEBHOOK END ==========");

    return false;
  }

  console.log("[DELLYMAN] Calling update_ongoing_status...");

  try {
    const result = await update_ongoing_status(
      id,
      order.OrderStatus,
      "dellyman",
    );

    console.log("[DELLYMAN] update_ongoing_status result:", result);

    console.log("========== DELLYMAN WEBHOOK END ==========");

    return result;
  } catch (error) {
    console.error("[DELLYMAN] update_ongoing_status error:", error);

    console.log("========== DELLYMAN WEBHOOK END ==========");

    return false;
  }
};

export { estimate_dellyman, create_dellyman, webhook_dellyman };
