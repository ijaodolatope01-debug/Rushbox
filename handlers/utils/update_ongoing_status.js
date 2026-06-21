import { ORDERS } from "../../ds/folders.js";
import STATUSES_MAPS from "../couriers/statuses_map.js";

const update_ongoing_status = async (courier_key, status, courier) => {
  let ongoing_status = STATUSES_MAPS[courier]?.[status.toUpperCase()];
  console.log(ongoing_status, courier_key, status, courier);

  if (!ongoing_status) return false;

  const Orders = await ORDERS();
  const result = await Orders.findOneAndUpdate(
    { courier_key },
    {
      $set: { ongoing_status, [ongoing_status]: Date.now() },
    },
    { returnDocument: "after" }, // return the document after update
  );

  console.log(result, "heyyyyyy");
  if (!result) {
    return {};
  }

  // return the modified order
  return { order: result };
};

export default update_ongoing_status;
