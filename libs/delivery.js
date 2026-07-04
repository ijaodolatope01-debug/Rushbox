const DELIVERY_STATUSES = ["ongoing", "completed", "canceled", "failed"];

const store_delivery = async (response, body, status, db) => {
  if (!response?.courier_key && !status) {
    return { _id: 0 };
  }

  let order = {
    courier: body.courier,
    sender_email: body.sender_email,
    sender_name: body.sender_name,
    courier_response: response?.courier_response,
    courier_key: response?.courier_key,
    pickup_address: body.pickup_address,
    dropoff_address: body.recipient_address,
    pickup_lat: body.pickup_latitude,
    pickup_lng: body.pickup_longitude,
    dropoff_lat: body.latitude,
    dropoff_lng: body.longitude,
    estimated_fare: body.value_of_item,
    status_message: status?.message,
    actual_fare: null,
    payment_reference: body.payment_reference,
    payment_status: body.payment_status,
    status: status?.state || "ongoing",
    norm: body.norm,
    user_id: body.user_id,
    created: new Date().toISOString(),
    _id: body.rushbox_id,
  };

  let res = await (await db.folder("Orders")).insertOne(order);

  return { _id: res.insertedId };
};

const delivery_failed = async (message, details, db) => {
  await store_delivery(null, details, { status: "failed", message }, db);
};

const validateEstimate = async (estimate_id, courier, db) => {
  let estimate = await (
    await db.folder("Estimates")
  ).findOne({ _id: estimate_id });

  if (!estimate) return "";
  else if (estimate.used) {
    return "Estimate has been used.";
  } else if (estimate.created + 60 * 60 * 1000 < Date.now()) {
    return "Estimate have expired. Fetch again.";
  }

  let courier_estimate = estimate.estimates[courier];

  return { courier_estimate, location_details: estimate.payload };
};

function normalise_order_response(data, details, courier) {
  let norm = {
    sender: {
      name: details.sender_name,
      phone: details.sender_phone,
    },
    reciever: {
      name: details.recipient_name,
      phone: details.recipient_phone,
    },
    pickup: {
      address: details.pickup_address,
      latitude: details.pickup_latitude,
      longitude: details.pickup_longitude,
    },
    dropoff: {
      address: details.recipient_address,
      latitude: details.dropoff_latitude,
      longitude: details.dropoff_longitude,
    },
    estimate_id: details.estimate_id,
    payment_reference: details.payment_reference || "Direct from Wallet.",
    delivery_notes: details.delivery_notes,
    delivery_fare: details.delivery_fare,
    courier: courier.name,
    courier_tracking: courier.tracking,
    order_id: data.rushbox_id,
  };

  return norm;
}

export {
  store_delivery,
  delivery_failed,
  validateEstimate,
  DELIVERY_STATUSES,
  normalise_order_response,
};
