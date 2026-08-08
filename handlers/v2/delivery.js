import {
  delivery_failed,
  DELIVERY_STATUSES,
  normalise_order_response,
  store_delivery,
  validateEstimate,
} from "../../libs/delivery.js";

import { courierStrategies } from "../../libs/couriers/index.js";
import {
  handle_payment_ref,
  initializePaystackTransaction,
} from "../../services/payment.js";
import { charge_wallet, revert_wallet } from "../../services/wallet.js";

const debug = (...args) => {
  if (process.env.DEV) {
    console.log(...args);
  }
};

const get_payment_url = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;
  let { delivery_details, estimate_id, product_price } = body;

  debug(estimate_id, product_price, "HOWWWW");
  const senderEmail = delivery_details?.details?.sender_email;

  debug(senderEmail, "ehlo");
  if (
    senderEmail &&
    !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
      senderEmail,
    )
  ) {
    return {
      ok: false,
      message: "Invalid sender email",
    };
  }
  debug(senderEmail);

  let estimate = await validateEstimate(
    estimate_id,
    delivery_details.courier,
    db,
  );
  if (typeof estimate === "string")
    return {
      ok: false,
      message: estimate || "Courier estimate not found",
    };

  delivery_details = {
    ...delivery_details,
    ...estimate.location_details,
    ...estimate.courier_estimate.meta,
    estimate_id,
  };

  estimate = estimate.courier_estimate;

  const payment_reference = crypto.randomUUID();
  delivery_details.payment_reference = payment_reference;

  await (
    await db.folder("Pending_deliveries")
  ).insertOne({
    _id: payment_reference,
    delivery_details,
    profile: profile._id,
    created: Date.now(),
  });

  const { email, _id: user_id } = headers.profile || {};

  const response = await initializePaystackTransaction({
    email,
    amount: parseInt(
      (Number(product_price) + Number(estimate.total_price)) * 100,
    ), // Convert to kobo
    reference: payment_reference,
    metadata: {
      user_id,
      estimate_id,
    },
  });

  if (!response.authorization_url) {
    return {
      ok: false,
      message: response.message || "Failed to initialize payment",
    };
  }

  return {
    ok: true,
    data: {
      payment_url: response.authorization_url,
      access_code: response.access_code,
      payment_reference,
    },
  };
};

const retrieve_order_by_reference = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { payment_reference } = body;

  let order = await (await db.folder("Orders")).findOne({ payment_reference });

  let data;

  if (!order)
    data = await (
      await db.folder("Pending_deliveries")
    ).findOne({
      _id: payment_reference,
      profile: profile._id,
    });

  return {
    ok: !!(data || order),
    message: data ? "Order pending" : order ? "Order retrieved" : "Not found",
    data: data || order,
  };
};

const create_delivery = async (req, opts) => {
  debug("[create_delivery] Starting handler", {
    from_webhook: opts?.from_webhook,
  });
  let { from_webhook, db } = opts || {};

  // from_webhook=true: called from webhook (no response sent), false: regular API request (response sent)
  let res = !from_webhook;

  if (res) {
    db = req.db;
    req.body.user_id = req.headers.profile?._id;
    debug("[create_delivery] API request mode", {
      user_id: req.body.user_id,
    });
  }
  try {
    let courierName, details, payment_reference;

    if (res) {
      courierName = req.body.courier.toLowerCase();

      details = {
        ...req.body.details,
        courier: courierName,
        payment_reference: req.body.payment_reference,
        user_id: req.body.user_id,
      };
      debug("[create_delivery] Parsed API request details", {
        courierName,
        payment_reference: details.payment_reference,
      });
    } else {
      const pending = req;

      details = {
        ...pending,
        ...pending?.details,
        user_id: pending.profile,
      };

      courierName = details.courier;
      debug("[create_delivery] Webhook mode - pending delivery", {
        courierName,
      });
    }
    if (!details.user_id) {
      debug("[create_delivery] Missing user_id");
      return {
        ok: false,
        message: "user_id is not found",
      };
    }

    let senderEmail = details.sender_email;
    if (
      senderEmail &&
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
        senderEmail,
      )
    ) {
      return {
        ok: false,
        message: "Invalid sender email",
      };
    }

    const rushbox_id = details.rushbox_id || crypto.randomUUID();
    details.rushbox_id = rushbox_id;
    debug("[create_delivery] Generated rushbox_id", { rushbox_id });

    let estimate = await validateEstimate(details.estimate_id, courierName, db);
    if (typeof estimate === "string") {
      debug("[create_delivery] Estimate validation failed", {
        error: estimate,
      });
      return {
        ok: false,
        message: estimate || "Courier estimate not found",
      };
    }
    debug("[create_delivery] Estimate validated", {
      estimate_id: details.estimate_id,
      total_price: estimate.courier_estimate?.total_price,
    });

    details = {
      ...details,
      ...estimate.location_details,
      ...estimate.courier_estimate?.meta,
    };

    estimate = estimate.courier_estimate;
    // Handle payment reference
    if (details.payment_reference) {
      debug("[create_delivery] Handling payment reference", {
        payment_reference: details.payment_reference,
      });
      const paymentStatus = await handle_payment_ref(
        details.payment_reference,
        details,
        db,
      );
      debug("[create_delivery] Payment status", { paymentStatus });

      if (["PENDING", "ALREADY_PENDING"].includes(paymentStatus)) {
        debug("[create_delivery] Payment pending");
        return {
          ok: false,
          message: "Pending",
          data: { order_id: rushbox_id },
        };
      }
    }

    // Charge wallet
    debug("[create_delivery] Charging wallet", {
      user_id: details.user_id,
      amount: estimate.total_price,
    });
    const charge = await charge_wallet(
      details.user_id,
      estimate.total_price,
      rushbox_id,
      details.payment_reference,
      db,
    );

    if (!charge.ok) {
      debug("[create_delivery] Wallet charge failed", {
        message: charge.message,
      });
      await delivery_failed(charge.message, details, db);
      return { ok: false, message: charge.message };
    }
    debug("[create_delivery] Wallet charged successfully");

    // Dispatch courier
    debug("[create_delivery] Dispatching courier", {
      courier: courierName,
    });
    const strategy = courierStrategies[courierName];
    if (!strategy) {
      debug("[create_delivery] Invalid courier strategy", {
        courier: courierName,
      });
      return { ok: false, message: "Invalid courier" };
    }

    const reply = await strategy(details);
    debug("[create_delivery] Courier dispatch response received", {
      courier_key: reply?.courier_key,
    });

    if (!reply?.courier_key) {
      debug("[create_delivery] Courier failed - reverting wallet", {
        message: reply?.message,
      });
      await revert_wallet(
        details.user_id,
        estimate.total_price,
        rushbox_id,
        db,
      );
      return { ok: false, message: reply?.message || "Courier failed" };
    }

    // Normalize
    debug("[create_delivery] Normalizing order response");
    const norm = normalise_order_response(reply.courier_response, details, {
      name: courierName,
      tracking: reply.courier_key,
    });

    // Persist
    debug("[create_delivery] Storing delivery", {
      rushbox_id,
      courier: courierName,
    });
    let store_response = await store_delivery(
      reply,
      {
        ...details,
        norm,
        courier: courierName,
        rushbox_id,
      },
      null,
      db,
    );
    debug(store_response);
    norm.order_id = rushbox_id;
    norm.order_status = store_response?.status;

    debug(norm);
    await (
      await db.folder("Estimates")
    ).updateOne({ _id: details.estimate_id }, { $set: { used: true } });
    debug("[create_delivery] Marked estimate as used", {
      estimate_id: details.estimate_id,
    });

    norm.courier_estimate = estimate;
    if (!res) {
      debug("[create_delivery] Webhook mode - no response sent");
      return;
    }

    debug("[create_delivery] Delivery created successfully", {
      rushbox_id,
    });
    return {
      ok: true,
      data: norm,
    };
  } catch (err) {
    console.error("[create_delivery] Error:", err);
    return {
      ok: false,
      status: 500,
      message: "Internal server error",
    };
  }
};

export { create_delivery, get_payment_url, retrieve_order_by_reference, debug };
