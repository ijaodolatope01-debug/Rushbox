import { debug } from "../../handlers/v2/delivery.js";
import update_ongoing_status from "../utils/update_ongoing_status.js";

const estimate_kwikpik = async ({
  pickup_address,
  destination_address,
  pickup_latitude,
  pickup_longitude,
  destination_latitude,
  destination_longitude,
}) => {
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
  const sig = req.headers["x-kwikpik-signature"];

  console.log("[KWIKPIK] webhook received");
  console.log("[KWIKPIK] staging:", staging);
  console.log("[KWIKPIK] signature header:", sig);

  if (sig) {
    const [timestampPart, signaturePart] = sig.split(",");

    console.log("[KWIKPIK] timestamp part:", timestampPart);
    console.log("[KWIKPIK] signature part:", signaturePart);

    const timestamp = timestampPart?.split("=")?.[1];
    const signature = signaturePart?.split("=")?.[1];

    console.log("[KWIKPIK] parsed timestamp:", timestamp);
    console.log("[KWIKPIK] parsed signature:", signature);

    const now = Math.floor(Date.now() / 1000);

    console.log("[KWIKPIK] current timestamp:", now);
    console.log(
      "[KWIKPIK] timestamp difference:",
      Math.abs(now - parseInt(timestamp)),
    );

    if (Math.abs(now - parseInt(timestamp)) > 300) {
      console.log("[KWIKPIK] timestamp validation failed");
      return false;
    }

    const payload_string = JSON.stringify(req.body);

    console.log("[KWIKPIK] payload string:", payload_string);

    const signing_string = `${timestamp}.${payload_string}`;

    console.log("[KWIKPIK] signing string:", signing_string);

    const secret = staging
      ? process.env.KWIKPIK_TEST_TOKEN
      : process.env.KWIKPIK_TOKEN;

    console.log("[KWIKPIK] using secret:", secret);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signing_string)
      .digest("hex");

    console.log("[KWIKPIK] received signature:", signature);
    console.log("[KWIKPIK] expected signature:", expectedSignature);
    console.log("[KWIKPIK] signatures match:", signature === expectedSignature);

    let valid = false;

    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (err) {
      console.log("[KWIKPIK] timingSafeEqual error:", err);
      return false;
    }

    console.log("[KWIKPIK] timing safe comparison:", valid);

    if (!valid) {
      console.log("[KWIKPIK] signature validation failed");
      return false;
    }
  } else {
    console.log("[KWIKPIK] no signature header provided");
  }

  const event = req.body;

  console.log("[KWIKPIK] event payload:", JSON.stringify(event, null, 2));

  const status = event.status || event?.data?.status;
  const request_id = event.requestId || event?.data?.trackingId;

  console.log("[KWIKPIK] extracted status:", status);
  console.log("[KWIKPIK] extracted request_id:", request_id);

  if (!status) {
    console.log("[KWIKPIK] missing status");
    return false;
  }

  const result = await update_ongoing_status(request_id, status, "kwikpik", {
    db: req.db,
  });

  console.log("[KWIKPIK] update result:", result);

  return result;
};

export { estimate_kwikpik, create_kwikpik, webhook_kwikpik };
