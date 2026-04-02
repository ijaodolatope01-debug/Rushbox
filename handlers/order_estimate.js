import { ESTIMATES } from "../ds/folders.js";
import { estimate_chowdeck } from "./couriers/chowdeck.js";
import { estimate_dellyman } from "./couriers/dellyman.js";
import { estimate_errandlr } from "./couriers/errandlr.js";
import { estimate_fez } from "./couriers/fez.js";
import { estimate_kwik } from "./couriers/kwik.js";
import { estimate_kwikpik } from "./couriers/kwikpik.js";
import { get_courier_ratings } from "./reviews.js";

const thirty_mins = () => {
  return (
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) +
    " to " +
    new Date(Date.now() + 30 * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
};

const DEFAULT_DURATION = "Same day";

const applyCharges = (estimate) => {
  if (!estimate) return null;

  const charge = estimate.price > 300 ? 500 : 300;

  return {
    ...estimate,
    charge,
    total_price: estimate.price + charge,
    duration: estimate.duration || DEFAULT_DURATION,
  };
};

let swaps = [
  ["pick_up_state", "recipient_state"],
  ["pickup_city", "recipient_city"],
  ["local_govt", "local_govt"],
  ["destination_latitude", "dropoff_latitude"],
  ["destination_longitude", "dropoff_longitude"],
  ["destination_placeid", "recipient_address"],
  ["pickup_placeid", "pickup_address"],
  ["source_longitude", "pickup_longitude", true],
  ["source_latitude", "pickup_latitude", true],
];

const swap_payload_key = (payload) => {
  swaps.map((sp) => {
    let [i, v, t] = sp;
    let val = payload[i];

    delete payload[i];
    if (t) val = Number(val);

    payload[v] = val;
  });

  return payload;
};

const fetch_estimates = async (req, res) => {
  const payload = req.body;

  const estimates = await Promise.all([
    estimate_chowdeck(payload),
    estimate_fez(payload),
    estimate_kwik(payload),
    estimate_dellyman(payload),
    estimate_kwikpik(payload),
    estimate_errandlr(payload),
  ]);

  let normalized = estimates
    .filter(Boolean)
    .map(applyCharges)
    .reduce((acc, item) => {
      acc[item.courier] = item;
      return acc;
    }, {});

  let estimate_id = crypto.randomUUID();
  await (
    await ESTIMATES()
  ).insertOne({
    _id: estimate_id,
    payload: swap_payload_key(payload),
    estimates: normalized,
    used: false,
    created: Date.now(),
  });

  for (let k in normalized) {
    let est = normalized[k];

    normalized[k].ratings = await get_courier_ratings(est.courier);
  }

  res.json({
    ok: true,
    message: "Estimate expires after 1 hour(s)",
    data: { estimates: normalized, _id: estimate_id },
  });
};

export { fetch_estimates, thirty_mins };
