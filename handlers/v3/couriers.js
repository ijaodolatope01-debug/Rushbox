import crypto from "crypto";
import { validate_courier_base } from "../../libs/v3/schema/validate_courier.js";
import { COLLECTIONS } from "../../libs/v3/store.js";

// A Mongo-style duplicate-key error carries code 11000 (or the string
// "E11000" in the message on some drivers/wrappers) — this is intentionally
// loose since we don't know your wrapper's exact error shape. Widen/replace
// this if it turns out to look different in practice.
const is_duplicate_key_error = (e) =>
  e?.code === 11000 || /E11000|duplicate key/i.test(e?.message || "");

// ------------------------------------------------------------ stage 1 ----
// Creates the courier record and hands back courier_id. auth, estimate,
// create, and webhook schemas each live in their own collection (see
// courier_schemas.js), keyed by this courier_id — nothing schema-shaped
// lives on this record itself.
//
// IMPORTANT: `name` must be unique, and the findOne-then-insertOne below is
// NOT enough to guarantee that on its own — two requests for the same name
// can both pass the findOne check before either one inserts. This code
// handles that race (see the catch block), but only a unique index on
// Couriers.name actually closes it. Add one via your DB's migration/setup
// path, e.g. (Mongo): db.collection("Couriers").createIndex({ name: 1 },
// { unique: true }). Without that index, this function is still safe (it
// won't crash or silently duplicate), it just can't fully prevent a
// duplicate row from existing in rare concurrent-write cases.
const add_courier = async (req) => {
  const { db, body } = req;
  const { name, base_url, staging_base_url = null } = body || {};

  const { errors } = validate_courier_base({
    name,
    base_url,
    staging_base_url,
  });
  if (errors.length) {
    return { ok: false, message: "Invalid courier", data: { errors } };
  }

  const Couriers = await db.folder(COLLECTIONS.couriers);

  // Fast path: catches the common case (someone re-running setup, or a
  // typo'd duplicate name) with a friendly message before ever hitting the
  // DB's unique constraint.
  const existing = await Couriers.findOne({ name });
  if (existing) {
    return {
      ok: false,
      message: `A courier named "${name}" already exists`,
      data: { courier_id: existing._id },
    };
  }

  const courier_id = crypto.randomUUID();

  try {
    await Couriers.insertOne({
      _id: courier_id,
      name,
      base_url,
      staging_base_url,
      created: Date.now(),
      updated: Date.now(),
    });
  } catch (e) {
    // Two requests raced past the findOne check above — the unique index
    // (if present) rejected the second insert. Look up whoever won instead
    // of surfacing a raw DB error.
    if (is_duplicate_key_error(e)) {
      const winner = await Couriers.findOne({ name });
      return {
        ok: false,
        message: `A courier named "${name}" already exists`,
        data: { courier_id: winner?._id },
      };
    }
    throw e;
  }

  return {
    ok: true,
    message:
      "Courier created — use courier_id to add auth, estimate, create, and webhook config",
    data: { courier_id },
  };
};

// List every registered courier (base records only). Use the individual
// get_courier_auth / get_courier_estimate / get_courier_create_delivery /
// get_courier_webhook handlers to pull a specific courier's schema config.
const get_couriers = async (req) => {
  const { db, body, query } = req;
  let { limit, page } = query;
  const { filter } = body || {};

  const Couriers = await db.folder(COLLECTIONS.couriers);
  // NOTE: assumes a Mongo-style .find(query).toArray() on the folder —
  // swap this for whatever your db wrapper's actual list method is if it
  // differs (the rest of this codebase only showed findOne/insertOne/
  // updateOne/findOneAndUpdate, never a list call).
  const couriers = await Couriers.find(filter ? { filter } : {})
    .limit(limit)
    .skip((page - 1) * limit)
    .toArray();

  return {
    ok: true,
    message: `${couriers.length} courier(s) found`,
    data: { couriers },
  };
};

export { add_courier, get_couriers };
