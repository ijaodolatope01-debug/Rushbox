// Five collections total: the base courier record, and one collection per
// schema piece (auth / estimate / create / webhook), each document keyed by
// courier_id as its _id — a 1:1 relationship, so no join table needed.
// Secrets follows the same 1:1 pattern: one document per courier_id whose
// `values` field is an encrypted JSON map of { [secret_ref]: plaintext }.

import { encrypt_secret, decrypt_secret } from "./crypto.js";

const COLLECTIONS = {
  couriers: "Couriers",
  auth: "CourierAuth",
  estimate: "CourierEstimateSchemas",
  create: "CourierCreateSchemas",
  webhook: "CourierWebhookSchemas",
  secrets: "Secrets",
};

const get_courier_by_id = async (db, courier_id) => {
  const Couriers = await db.folder(COLLECTIONS.couriers);
  return Couriers.findOne({ _id: courier_id });
};

// Create-or-update a schema document for one courier in one collection.
// Returns { created: true } on first write, { created: false } on every
// write after that, so handlers can report which happened.
const upsert_schema = async (db, collection, courier_id, fields) => {
  const folder = await db.folder(collection);
  const existing = await folder.findOne({ _id: courier_id });
  const now = Date.now();

  if (existing) {
    await folder.updateOne(
      { _id: courier_id },
      { $set: { ...fields, updated: now } },
    );
    return { created: false };
  }

  await folder.insertOne({
    _id: courier_id,
    courier_id,
    ...fields,
    created: now,
    updated: now,
  });
  return { created: true };
};

const get_schema = async (db, collection, courier_id) => {
  const folder = await db.folder(collection);
  return folder.findOne({ _id: courier_id });
};

// ---------------------------------------------------------------- secrets ----
// One document per courier (_id === courier_id).
// Shape stored in DB:
//   {
//     _id: <courier_id>,
//     courier_id,
//     values: <encrypt_secret(JSON.stringify({ TOPE_EMAIL: "...", ... }))>,
//     created, updated
//   }
//
// Callers always work with the plain object; encryption/decryption stays
// inside these helpers.

const upsert_courier_secrets = async (db, courier_id, secretsMap) => {
  if (!courier_id) throw new Error("courier_id is required");
  if (
    !secretsMap ||
    typeof secretsMap !== "object" ||
    Array.isArray(secretsMap)
  ) {
    throw new TypeError("secretsMap must be a plain object");
  }

  const encrypted = encrypt_secret(JSON.stringify(secretsMap));
  return upsert_schema(db, COLLECTIONS.secrets, courier_id, {
    values: encrypted,
  });
};

const get_courier_secrets = async (db, courier_id) => {
  if (!courier_id) return null;
  const record = await get_schema(db, COLLECTIONS.secrets, courier_id);
  if (!record?.values) return null;

  const decrypted = decrypt_secret(record.values);
  if (decrypted == null) return null;

  try {
    return typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;
  } catch {
    return null;
  }
};

// Walks an auth/webhook config subtree and collects every secret_ref /
// staging_secret_ref it finds.
const collect_secret_keys = (node, acc = []) => {
  if (!node || typeof node !== "object") return acc;
  if (node.secret_ref) acc.push(node.secret_ref);
  if (node.staging_secret_ref) acc.push(node.staging_secret_ref);
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collect_secret_keys(value, acc);
  }
  return acc;
};

// ---------------------------------------------------- runtime assembly ----
const get_full_courier = async (db, courier_id) => {
  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return null;

  const [auth, estimate, create, webhook, secretsMap] = await Promise.all([
    get_schema(db, COLLECTIONS.auth, courier_id),
    get_schema(db, COLLECTIONS.estimate, courier_id),
    get_schema(db, COLLECTIONS.create, courier_id),
    get_schema(db, COLLECTIONS.webhook, courier_id),
    get_courier_secrets(db, courier_id),
  ]);

  const auth_config = auth?.auth ?? null;
  const webhook_config = webhook?.webhook ?? null;

  // secretsMap is already the decrypted { [secret_ref]: value } object
  // (or null if none stored yet). engine.js can read config.secrets directly.
  return {
    _id: courier._id,
    name: courier.name,
    base_url: courier.base_url,
    staging_base_url: courier.staging_base_url,
    auth: auth_config,
    estimate: estimate?.estimate ?? null,
    create: create?.create ?? null,
    webhook: webhook_config,
    secrets: secretsMap ?? {},
  };
};

const get_all_full_couriers = async (db) => {
  const Couriers = await db.folder(COLLECTIONS.couriers);
  const base = await Couriers.find({}).toArray();
  return Promise.all(base.map((c) => get_full_courier(db, c._id)));
};

export {
  COLLECTIONS,
  get_courier_by_id,
  upsert_schema,
  get_schema,
  upsert_courier_secrets,
  get_courier_secrets,
  collect_secret_keys,
  get_full_courier,
  get_all_full_couriers,
};
