import update_ongoing_status from "../utils/update_ongoing_status";

const estimate_kwikpik = async ({
  pickup_label,
  destination_label,
  source_latitude,
  source_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    const res = await fetch(
      "https://api.kwikpik.io/partners/requests/estimate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.KWIKPIK_TOKEN,
        },
        body: JSON.stringify({
          insured: false,
          deliveryLocation: {
            latitude: Number(destination_latitude),
            longitude: Number(destination_longitude),
            address: destination_label,
          },
          pickupLocation: {
            latitude: Number(source_latitude),
            longitude: Number(source_longitude),
            address: pickup_label,
          },
        }),
      },
    );

    const data = await res.json();

    console.log(data);
    if (!data.result) return null;

    return {
      courier: "kwikpik",
      price: data.result.total,
      duration: data.result.duration,
    };
  } catch {
    return null;
  }
};

async function create_kwikpik(details) {
  const {
    dropoff_latitude,
    dropoff_longitude,
    recipient_address,
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
  } = details;

  let reply = {};
  let data;

  try {
    let payload = {
      vehicleType: "motorcycle",
      deliveryLocation: {
        latitude: Number(dropoff_latitude),
        longitude: Number(dropoff_longitude),
        address: recipient_address,
      },
      pickupLocation: {
        latitude: pickup_latitude,
        longitude: pickup_longitude,
        address: pickup_address,
      },
      senderName: sender_name,
      senderEmail: sender_email,
      senderPhoneNumber: sender_phone,
      recipientName: recipient_name,
      recipientPhoneNumber: recipient_phone,
      description: package_detail,
      itemCategory: order_name,
      itemValue: value_of_item,
      itemWeight: package_weight,
      itemName: order_name,
      insured: false,
    };

    const response = await fetch(
      "https://api.kwikpik.io/partners/requests/initiate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": process.env.KWIKPIK_TOKEN,
        },
        body: JSON.stringify(payload),
      },
    );

    data = await response.json();

    if (data.result) {
      reply.courier_key = data?.result?.id;
      reply.courier_response = data?.result;
    }
  } catch (error) {
    console.error("Error initiating delivery:", error);
  }

  return reply;
}

const webhook_kwikpik = async () => {
  let event = req.body;

  let { status, trackingId } = event?.data || {};

  if (!status) {
    return false;
  }

  return await update_ongoing_status(trackingId, status, "kwikpik");
};

export { estimate_kwikpik, create_kwikpik, webhook_kwikpik };
