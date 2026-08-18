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

    console.log(data, "KWIKPIK");
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
  let sig = req.headers["x-kwikpik-signature"];

  if (sig) {
    const [timestampPart, signaturePart] = sig?.split(",");
    const timestamp = timestampPart.split("=")[1];
    const signature = signaturePart.split("=")[1];

    // Check timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        staging ? process.env.KWIKPIK_TEST_TOKEN : process.env.KWIKPIK_TOKEN,
      )
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    )
      return false;
  }

  let event = req.body;

  // console.log(event, "WEBHOOK KWIPK");
  // let { status, trackingId } = event?.data || {};
  let status = event.status || event?.data?.status;
  let request_id = event.requestId || event?.data?.trackingId;

  if (!status) {
    return false;
  }

  return await update_ongoing_status(request_id, status, "kwikpik");
};

export { estimate_kwikpik, create_kwikpik, webhook_kwikpik };
