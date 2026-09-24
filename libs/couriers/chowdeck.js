import { debug } from "../../handlers/v2/delivery.js";
import update_ongoing_status from "../utils/update_ongoing_status.js";
import crypto from "crypto";

const estimate_chowdeck = async ({
  pickup_latitude,
  pickup_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    const res = await fetch("https://api.chowdeck.com/relay/delivery/fee", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.STAGING ? process.env.CHOW_TEST_TOKEN : process.env.CHOWDECK_TOKEN}`,
      },
      body: JSON.stringify({
        source_address: {
          latitude: pickup_latitude,
          longitude: pickup_longitude,
        },
        destination_address: {
          latitude: destination_latitude,
          longitude: destination_longitude,
        },
      }),
    });

    const data = await res.json();
    debug(data, "chowdeck estimate");

    if (data.status !== "success") return null;

    return {
      courier: "chowdeck",
      price: data.data.total_amount / 100,
      meta: { fee_id: data.data.id },
    };
  } catch {
    return null;
  }
};

async function create_chowdeck(details) {
  const {
    recipient_name,
    recipient_phone,
    sender_name,
    sender_phone,
    sender_email,
    fee_id,
    order_name,
    value_of_item,
    package_detail,
  } = details;

  let reply = {};
  let data;

  try {
    const response = await fetch("https://api.chowdeck.com/relay/delivery", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.STAGING ? process.env.CHOW_TEST_TOKEN : process.env.CHOWDECK_TOKEN}`,
      },
      body: JSON.stringify({
        destination_contact: {
          country_code: "NG",
          name: recipient_name,
          phone: recipient_phone,
        },
        source_contact: {
          country_code: "NG",
          name: sender_name,
          phone: sender_phone,
          email: sender_email,
        },
        user_action: "sending",
        fee_id,
        item_type: order_name,
        estimated_order_amount: value_of_item,
        customer_delivery_note: package_detail,
      }),
    });

    data = await response.json();
    debug(data, "showdec");
    data = data?.data || data;

    reply.courier_key = data?.id;
    reply.courier_response = data;
  } catch (e) {
    console.log(e);
    reply.message = e.message;
  }

  return reply;
}

const webhook_chowdeck = async (req, { staging }) => {
  const body = JSON.stringify(req.body);

  await (
    await req.db.folder("Webhook_payload")
  ).insertOne({
    _id: crypto.randomUUID(),
    body: req.body,
    created: Date.now(),
  });

  const signature = crypto
    .createHmac(
      "sha256",
      staging ? process.env.CHOW_TEST_TOKEN : process.env.CHOWDECK_TOKEN,
    )
    .update(body)
    .digest("hex");

  console.log({
    generated: signature,
    received: req.headers["x-chowdeck-signature"],
    staging,
  });

  if (signature !== req.headers["x-chowdeck-signature"]) {
    return false;
  }

  const event = req.body;
  const { payload, category } = event;

  return await update_ongoing_status(payload.id, category, "chowdeck", {
    db: req.db,
  });
};

export { estimate_chowdeck, create_chowdeck, webhook_chowdeck };
