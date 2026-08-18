import STATUSES_MAPS, { STATUSES_MESSAGE } from "../couriers/statuses_map.js";

const update_ongoing_status = async (courier_key, status, courier, { db }) => {
  console.log("========== UPDATE ONGOING STATUS START ==========");

  console.log("[STATUS] Courier key:", courier_key);
  console.log("[STATUS] Incoming status:", status);
  console.log("[STATUS] Courier:", courier);

  const status_key = status?.toUpperCase();

  console.log("[STATUS] Normalized status:", status_key);

  const ongoing_status = STATUSES_MAPS[courier]?.[status_key];

  console.log("[STATUS] Mapped ongoing status:", ongoing_status);

  if (!ongoing_status) {
    console.log("[STATUS] No status mapping found");
    console.log("========== UPDATE ONGOING STATUS END ==========");

    return false;
  }

  const Orders = await db.folder("Orders");

  console.log("[STATUS] Orders collection loaded");

  let update = {
    ongoing_status,
  };

  console.log("[STATUS] Initial update:", update);

  if (ongoing_status === 10) {
    update.status = "completed";

    console.log('[STATUS] Ongoing status is 10 → order marked "completed"');
  } else if (ongoing_status < 0) {
    update.status = "failed";

    console.log('[STATUS] Ongoing status is negative → order marked "failed"');
  }

  console.log("[STATUS] Final MongoDB update:", update);

  console.log("[STATUS] Finding order with courier_key:", courier_key);

  console.log("[STATUS] Order Preview:", await Orders.findOne({ courier_key }));
  update.status_message = STATUSES_MESSAGE[ongoing_status];
  const result = await Orders.findOneAndUpdate(
    { courier_key },
    {
      $set: update,
      $push: {
        tracking: [
          ongoing_status,
          Date.now(),
          STATUSES_MESSAGE[ongoing_status],
        ],
      },
    },
    {
      returnDocument: "after",
    },
  );

  console.log("[STATUS] MongoDB update result:", result);

  if (!result) {
    console.log("[STATUS] No order found or update returned no result");

    console.log("========== UPDATE ONGOING STATUS END ==========");

    return {};
  }

  console.log("[STATUS] Order successfully updated:", result);

  console.log("[STATUS] Updated order ID:", result._id);

  console.log("[STATUS] Current ongoing status:", result.ongoing_status);

  console.log("[STATUS] Current order status:", result.status);

  console.log("[STATUS] Tracking:", result.tracking);

  console.log("========== UPDATE ONGOING STATUS END ==========");

  return {
    order: result,
  };
};

export default update_ongoing_status;
