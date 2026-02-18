import { ESTIMATES, ORDERS } from "../ds/folders.js";
import { courierStrategies } from "./couriers/index.js";
import { handle_payment_ref } from "../services/payment.js";
import { charge_wallet, revert_wallet } from "../services/wallet.js";

const DELIVERY_STATUSES = ["ongoing", "completed", "canceled", "failed"];

const store_delivery = async (response, body, status) => {
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

  let res = await (await ORDERS()).insertOne(order);

  return { _id: res.insertedId };
};

const delivery_failed = async (message, details) => {
  await store_delivery(null, details, { status: "failed", message });
};

const validateEstimate = async (estimate_id, courier) => {
  let estimate = await (await ESTIMATES()).findOne({ _id: estimate_id });

  console.log(estimate_id, courier);

  if (estimate) estimate = estimate.estimates;
  else return;

  let courier_estimate = estimate[courier];

  console.log(courier_estimate);

  return courier_estimate;
};

const create_delivery = async (req, res) => {
  try {
    let courierName, details;
    if (res) {
      courierName = req.body.courier.toLowerCase();
      details = req.body.details;
      details.courier = courierName;

      details.user_id = req.body.user_id;
    } else {
      details = req;
      courierName = details.courier;
    }

    const rushbox_id = details.rushbox_id || crypto.randomUUID();
    details.rushbox_id = rushbox_id;

    const estimate = await validateEstimate(details.estimate_id, courierName);
    if (!estimate)
      return res.json({ ok: false, message: "Courier estimate not found" });

    // Handle payment reference
    if (details.payment_reference) {
      const paymentStatus = await handle_payment_ref(
        details.payment_reference,
        details,
      );

      if (paymentStatus === "PENDING") {
        return res.json({
          ok: false,
          message: "Pending",
          data: { order_id: rushbox_id },
        });
      }
    }

    // Charge wallet
    const charge = await charge_wallet(
      details.user_id,
      estimate.total_price,
      rushbox_id,
    );

    if (!charge.ok) {
      await delivery_failed(charge.message, details);
      return res.json({ ok: false, message: charge.message });
    }

    details = { ...details, ...estimate.meta };
    // Dispatch courier
    const strategy = courierStrategies[courierName];
    if (!strategy) return res.json({ ok: false, message: "Invalid courier" });

    const reply = await strategy(details);

    if (!reply?.courier_key) {
      await revert_wallet(details.user_id, estimate.total_price, rushbox_id);
      return res.json({ ok: false, message: "Courier failed" });
    }

    // Normalize
    const norm = normalise_order_response(reply.courier_response, details, {
      name: courierName,
      tracking: reply.courier_key,
    });

    // Persist
    await store_delivery(reply, {
      ...details,
      norm,
      courier: courierName,
      rushbox_id,
    });

    norm.order_id = rushbox_id;

    await (await ESTIMATES()).deleteOne({ _id: details.estimate_id });

    return res.json({
      ok: true,
      data: norm,
    });
  } catch (err) {
    console.error(err);
    return res.json({
      ok: false,
      message: "Internal server error",
    });
  }
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
    delivery_notes: details.delivery_notes,
    delivery_fare: details.delivery_fare,
    courier: courier.name,
    courier_tracking: courier.tracking,
    order_id: data.rushbox_id,
  };

  return norm;
}

export { create_delivery, DELIVERY_STATUSES };
