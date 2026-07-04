import { estimate_chowdeck } from "../../libs/couriers/chowdeck.js";
import { estimate_dellyman } from "../../libs/couriers/dellyman.js";
import { estimate_errandlr } from "../../libs/couriers/errandlr.js";
import { estimate_fez } from "../../libs/couriers/fez.js";
import { estimate_kwik } from "../../libs/couriers/kwik.js";
import { estimate_kwikpik } from "../../libs/couriers/kwikpik.js";
import { applyCharges, swap_payload_key } from "../../libs/estimates.js";
import { get_courier_ratings } from "./reviews.js";

const fetch_estimates = async (req) => {
  let { db, headers } = req;
  let { profile } = headers;
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
    await db.folder("Estimates")
  ).insertOne({
    _id: estimate_id,
    payload: swap_payload_key(payload),
    estimates: normalized,
    used: false,
    created: Date.now(),
  });

  for (let k in normalized) {
    let est = normalized[k];

    normalized[k].ratings = await get_courier_ratings(est.courier, db);
  }

  return {
    ok: true,
    message: "Estimate expires after 1 hour(s)",
    data: { estimates: normalized, _id: estimate_id, profile: profile._id },
  };
};

export { fetch_estimates };
