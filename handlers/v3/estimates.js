import { get_all_full_couriers } from "../../libs/v3/store.js";
import { runEstimate } from "../../libs/v3/engine.js";
import { get_courier_ratings } from "../../libs/ratings.js";
import { applyCharges, swap_payload_key } from "../../libs/estimates.js";
import { debug } from "../v2/delivery.js";

const duration_rank = (duration) => {
  if (typeof duration === "number") return duration;
  if (typeof duration !== "string") return Infinity;

  const value = duration.toLowerCase();
  if (value.includes("next day")) return 24 * 60;
  if (value.includes("same day") || value.includes("today")) return 12 * 60;

  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return Infinity;

  const amount = Number(match[0]);
  if (value.includes("day")) return amount * 24 * 60;
  if (value.includes("hour") || value.includes("hr")) return amount * 60;
  return amount;
};

const filter_estimates = (estimates, filter) => {
  if (!filter) return estimates;

  const { type, limit } = filter;

  if (!["cheapest", "quickest", "highest-rating"].includes(type)) {
    return estimates;
  }

  const entries = Object.entries(estimates);

  entries.sort(([, a], [, b]) => {
    if (type === "cheapest") {
      return a.total_price - b.total_price;
    }

    if (type === "quickest") {
      return duration_rank(a.duration) - duration_rank(b.duration);
    }

    if (type === "highest-rating") {
      const aHasRatings = a.ratings?.total > 0;
      const bHasRatings = b.ratings?.total > 0;

      // Rated couriers come before unrated couriers
      if (aHasRatings !== bHasRatings) {
        return bHasRatings - aHasRatings;
      }

      return (b.ratings?.avg ?? 0) - (a.ratings?.avg ?? 0);
    }

    return 0;
  });

  return Object.fromEntries(entries.slice(0, Number(limit) || entries.length));
};

const LAGOS_COVERAGE = {
  min_latitude: 6.35,
  max_latitude: 6.75,
  min_longitude: 2.7,
  max_longitude: 4.0,
};

const is_lagos = (latitude, longitude) => {
  latitude = Number(latitude);
  longitude = Number(longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  return (
    latitude >= LAGOS_COVERAGE.min_latitude &&
    latitude <= LAGOS_COVERAGE.max_latitude &&
    longitude >= LAGOS_COVERAGE.min_longitude &&
    longitude <= LAGOS_COVERAGE.max_longitude
  );
};

const is_covered = (payload) => {
  const pickup = is_lagos(payload.pickup_latitude, payload.pickup_longitude);

  const destination = is_lagos(
    payload.destination_latitude,
    payload.destination_longitude,
  );

  return pickup && destination;
};

const fetch_estimates = async (req) => {
  let { db, headers } = req;
  let { profile } = headers;
  const payload = req.body;
  let filter = payload.filter;
  delete payload.filter;

  if (!is_covered(payload)) {
    return {
      ok: false,
      message: "Locations entered are not within our coverage area yet",
      data: {
        estimates: {},
      },
    };
  }

  const couriers = await get_all_full_couriers(db);
  // Skip couriers that are registered but not fully set up yet (no
  // estimate schema saved) rather than letting the engine choke on a null
  // config — a courier mid-onboarding shouldn't break estimates for
  // everyone else.
  const configured = couriers.filter((c) => c?.estimate);

  debug(JSON.stringify(couriers, null, 2), "howwwwww?");
  const results = await Promise.all(
    configured.map((config) => runEstimate(config, payload)),
  );

  debug(results, "howw");

  // Stamp courier_id onto each result — whatever shape runEstimate/
  // applyCharges hand back, this survives into the stored Estimates doc so
  // create_delivery can fetch this exact courier from the db later instead
  // of matching courierName against a hardcoded list.
  let normalized = results
    .map((result, i) =>
      result ? { ...result, courier_id: configured[i]._id } : null,
    )
    .filter(Boolean)
    .map((item) => ({ ...applyCharges(item), courier_id: item.courier_id }))
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

  if (filter) {
    debug(filter);
    normalized = filter_estimates(normalized, filter);
  }

  return {
    ok: true,
    message: "Estimate expires after 1 hour(s)",
    data: { estimates: normalized, _id: estimate_id, profile: profile._id },
  };
};

export { fetch_estimates };
