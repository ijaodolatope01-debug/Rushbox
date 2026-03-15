import update_ongoing_status from "../utils/update_ongoing_status.js";

const estimate_chowdeck = async ({
  source_latitude,
  source_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    const res = await fetch("https://api.chowdeck.com/relay/delivery/fee", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.CHOW_TOKEN}`,
      },
      body: JSON.stringify({
        source_address: {
          latitude: source_latitude,
          longitude: source_longitude,
        },
        destination_address: {
          latitude: destination_latitude,
          longitude: destination_longitude,
        },
      }),
    });

    const data = await res.json();

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
        Authorization: `Bearer ${process.env.CHOW_TOKEN}`,
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
    data = data?.data || data;

    reply.courier_key = data?.id;
    reply.courier_response = data;
  } catch (e) {
    console.log(e);
  }

  return reply;
}

const webhook_chowdeck = async (req, res) => {
  const hash = crypto
    .createHmac("sha512", process.env.CHOW_TOKEN)
    .update(JSON.stringify(req.body))
    .digest("hex");

  // if (hash != req.headers["x-chowdeck-signature"]) {
  //   return false;
  // }

  // Retrieve the request's body
  const event = req.body;
  let { status, data } = event;

  let id = data?.tracking?.[0]?.trackingId;

  return await update_ongoing_status(id, status.split(".")[1], "chowdeck");
};

export { estimate_chowdeck, create_chowdeck, webhook_chowdeck };
