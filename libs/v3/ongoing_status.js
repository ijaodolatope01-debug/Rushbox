import { STATUSES_MESSAGE } from "../couriers/statuses_map.js"; // unchanged, keep as-is

const update_ongoing_status = async (courier_key, ongoing_status, { db }) => {
  const Orders = await db.folder("Orders");

  let update = { ongoing_status };
  if (ongoing_status === 10) update.status = "completed";
  else if (ongoing_status < 0) update.status = "failed";
  update.status_message = STATUSES_MESSAGE[ongoing_status];

  const result = await Orders.findOneAndUpdate(
    { courier_key: String(courier_key) },
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
    { returnDocument: "after" },
  );

  return result ? { order: result } : {};
};

export default update_ongoing_status;
