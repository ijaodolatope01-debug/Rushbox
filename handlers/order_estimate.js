import { estimate_chowdeck } from "./couriers/chowdeck.js";
import { estimate_dellyman } from "./couriers/dellyman.js";
import { estimate_errandlr } from "./couriers/errandlr.js";
import { estimate_fez } from "./couriers/fez.js";
import { estimate_kwik } from "./couriers/kwik.js";
import { estimate_kwikpik } from "./couriers/kwikpik.js";

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

  const normalized = estimates
    .filter(Boolean)
    .map(applyCharges)
    .reduce((acc, item) => {
      acc[item.courier] = item;
      return acc;
    }, {});

  res.json({ ok: true, data: normalized });
};

export { fetch_estimates, thirty_mins };
