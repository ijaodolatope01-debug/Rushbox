import { estimate_chowdeck } from "../../libs/couriers/chowdeck.js";
import { estimate_dellyman } from "../../libs/couriers/dellyman.js";
import { estimate_errandlr } from "../../libs/couriers/errandlr.js";
import { estimate_fez } from "../../libs/couriers/fez.js";
import { estimate_kwik } from "../../libs/couriers/kwik.js";
import { estimate_kwikpik } from "../../libs/couriers/kwikpik.js";
import { applyCharges, swap_payload_key } from "../../libs/estimates.js";
import { debug } from "./delivery.js";
import { get_courier_ratings } from "./reviews.js";

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

const normalize_payload = (body = {}) => {
  const pickup = body.pickup || {};
  const dropoff = body.dropoff || {};

  return {
    ...body,

    pickup_address: body.pickup_address ?? pickup.address,

    pickup_latitude: body.pickup_latitude ?? pickup.latitude,

    pickup_longitude: body.pickup_longitude ?? pickup.longitude,

    dropoff_address: body.dropoff_address ?? dropoff.address,

    dropoff_latitude: body.dropoff_latitude ?? dropoff.latitude,

    dropoff_longitude: body.dropoff_longitude ?? dropoff.longitude,

    package_weight: Number(body.package_weight) || 0,

    value_of_item: Number(body.value_of_item) || 0,
  };
};

const reverse_geocode = async (lat, lng) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    `${lat},${lng}`,
  )}&key=${encodeURIComponent(apiKey || "")}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return {};

    const json = await res.json();
    if (json.status !== "OK" || !json.results?.length) return {};

    const result = json.results[0];
    const components = result.address_components || [];
    const get = (type) =>
      components.find((component) => component.types.includes(type))?.long_name;

    return {
      address: result.formatted_address,
      state: get("administrative_area_level_1"),
      city: get("locality") || get("administrative_area_level_2"),
      country: get("country"),
      local_govt: get("administrative_area_level_2"),
    };
  } catch {
    return {};
  }
};

const expand_payload = async (payload) => {
  const [pickup, destination] = await Promise.all([
    reverse_geocode(payload.pickup_latitude, payload.pickup_longitude),
    reverse_geocode(payload.dropoff_latitude, payload.dropoff_longitude),
  ]);

  return {
    ...payload,
    pickup_address: payload.pickup_address ?? pickup.address,
    pickup_state: pickup.state,
    pickup_city: pickup.city,
    destination_address: payload.dropoff_address ?? destination.address,
    destination_state: destination.state,
    destination_city: destination.city,
    destination_latitude: payload.dropoff_latitude,
    destination_longitude: payload.dropoff_longitude,
    destination_country: destination.country,
    local_govt: destination.local_govt ?? pickup.local_govt,
  };
};

const fetch_estimates = async (req) => {
  let { db, headers } = req;
  let { profile } = headers;

  debug("Before", req.body);

  const normalized_request = normalize_payload(req.body);

  let payload = await expand_payload(normalized_request);

  debug("After", payload);
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

  const estimates = await Promise.all([
    estimate_chowdeck(payload),
    estimate_fez(payload),
    estimate_kwik(payload),
    estimate_dellyman(payload),
    estimate_kwikpik(payload),
    estimate_errandlr(payload),
  ]);

  debug(estimates, "howw");

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
