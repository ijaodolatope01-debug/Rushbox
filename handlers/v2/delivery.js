import {
  DELIVERY_STATUSES,
  normalise_order_response,
  store_delivery,
  validateEstimate,
} from "../../libs/delivery.js";

import { courierStrategies } from "../../libs/couriers/index.js";
import { handle_payment_ref } from "../../services/payment.js";
import { charge_wallet, revert_wallet } from "../../services/wallet.js";

const create_delivery = async (req, opts) => {
  let { from_webhook, db } = opts || {};
  let res = !from_webhook;
  if (res) {
    db = req.db;
  }
  try {
    let courierName, details, payment_reference;
    if (res) {
      courierName = req.body.courier.toLowerCase();
      payment_reference = req.body.payment_reference;
      details = req.body.details;
      details.courier = courierName;
      details.payment_reference = payment_reference;

      details.user_id = req.body.user_id;
    } else {
      details = req;
      courierName = details.courier;
    }

    const rushbox_id = details.rushbox_id || crypto.randomUUID();
    details.rushbox_id = rushbox_id;

    let estimate = await validateEstimate(details.estimate_id, courierName, db);
    if (typeof estimate === "string")
      return {
        ok: false,
        message: estimate || "Courier estimate not found",
      };

    details = {
      ...details,
      ...estimate.location_details,
      ...estimate.courier_estimate.meta,
    };

    estimate = estimate.courier_estimate;
    // Handle payment reference
    if (details.payment_reference) {
      const paymentStatus = await handle_payment_ref(
        details.payment_reference,
        details,
        db,
      );

      if (["PENDING", "ALREADY_PENDING"].includes(paymentStatus)) {
        return {
          ok: false,
          message: "Pending",
          data: { order_id: rushbox_id },
        };
      }
    }

    // Charge wallet
    const charge = await charge_wallet(
      details.user_id,
      estimate.total_price,
      rushbox_id,
      details.payment_reference,
      db,
    );

    if (!charge.ok) {
      await delivery_failed(charge.message, details, db);
      return { ok: false, message: charge.message };
    }

    // Dispatch courier
    const strategy = courierStrategies[courierName];
    if (!strategy) return { ok: false, message: "Invalid courier" };

    const reply = await strategy(details);

    if (!reply?.courier_key) {
      await revert_wallet(
        details.user_id,
        estimate.total_price,
        rushbox_id,
        db,
      );
      return { ok: false, message: reply?.message || "Courier failed" };
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
      db,
    });

    norm.order_id = rushbox_id;

    await (
      await db.folder("Estimates")
    ).updateOne({ _id: details.estimate_id }, { $set: { used: true } });

    if (!res) return;

    return {
      ok: true,
      data: norm,
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      status: 500,
      message: "Internal server error",
    };
  }
};

export { create_delivery };
