import {
  validate_auth,
  validate_estimate,
  validate_create,
  validate_webhook,
  validate_secrets,
} from "../../libs/v3/schema/validate_courier.js";
import {
  COLLECTIONS,
  get_courier_by_id,
  upsert_schema,
  get_schema,
  upsert_courier_secrets,
  get_courier_secrets,
} from "../../libs/v3/store.js";

// ---------------------------------------------------------------- auth ----
const add_courier_auth = async (req) => {
  const { db, body } = req;
  const { courier_id, auth } = body || {};

  if (!courier_id) return { ok: false, message: "courier_id is required" };

  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return { ok: false, message: "Courier not found" };

  const { errors } = validate_auth(auth);
  if (errors.length) {
    return { ok: false, message: "Invalid auth config", data: { errors } };
  }

  const { created } = await upsert_schema(db, COLLECTIONS.auth, courier_id, {
    auth,
  });

  return {
    ok: true,
    message: created ? "Auth config created" : "Auth config updated",
    data: { courier_id },
  };
};

const get_courier_auth = async (req) => {
  const { db } = req;
  const courier_id = req.body?.courier_id;

  const record = await get_schema(db, COLLECTIONS.auth, courier_id);
  if (!record)
    return { ok: false, message: "No auth config set for this courier" };

  return { ok: true, message: "Auth config retrieved", data: record };
};

// ------------------------------------------------------------ estimate ----
const add_courier_estimate = async (req) => {
  const { db, body } = req;
  const { courier_id, estimate } = body || {};

  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return { ok: false, message: "Courier not found" };

  const { errors } = validate_estimate(estimate);
  if (errors.length) {
    return { ok: false, message: "Invalid estimate schema", data: { errors } };
  }

  const { created } = await upsert_schema(
    db,
    COLLECTIONS.estimate,
    courier_id,
    { estimate },
  );

  return {
    ok: true,
    message: created ? "Estimate schema created" : "Estimate schema updated",
    data: { courier_id },
  };
};

const get_courier_estimate = async (req) => {
  const { db } = req;
  const courier_id = req.query?.courier_id || req.body?.courier_id;

  const record = await get_schema(db, COLLECTIONS.estimate, courier_id);
  if (!record)
    return { ok: false, message: "No estimate schema set for this courier" };

  return { ok: true, message: "Estimate schema retrieved", data: record };
};

// -------------------------------------------------------- create_delivery -
const add_courier_create_delivery = async (req) => {
  const { db, body } = req;
  const { courier_id, create } = body || {};

  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return { ok: false, message: "Courier not found" };

  const { errors } = validate_create(create);
  if (errors.length) {
    return {
      ok: false,
      message: "Invalid create_delivery schema",
      data: { errors },
    };
  }

  const { created } = await upsert_schema(db, COLLECTIONS.create, courier_id, {
    create,
  });

  return {
    ok: true,
    message: created
      ? "create_delivery schema created"
      : "create_delivery schema updated",
    data: { courier_id },
  };
};

const get_courier_create_delivery = async (req) => {
  const { db } = req;
  const courier_id = req.query?.courier_id || req.body?.courier_id;

  const record = await get_schema(db, COLLECTIONS.create, courier_id);
  if (!record) {
    return {
      ok: false,
      message: "No create_delivery schema set for this courier",
    };
  }

  return {
    ok: true,
    message: "create_delivery schema retrieved",
    data: record,
  };
};

// --------------------------------------------------------------- webhook --
const add_courier_webhook = async (req) => {
  const { db, body } = req;
  const { courier_id, webhook } = body || {};

  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return { ok: false, message: "Courier not found" };

  const { errors, warnings } = validate_webhook(webhook);
  if (errors.length) {
    return { ok: false, message: "Invalid webhook schema", data: { errors } };
  }

  const { created } = await upsert_schema(db, COLLECTIONS.webhook, courier_id, {
    webhook,
  });

  const verb = created ? "created" : "updated";
  return {
    ok: true,
    message: warnings.length
      ? `Webhook schema ${verb} — with warnings`
      : `Webhook schema ${verb}`,
    data: { courier_id, warnings },
  };
};

const get_courier_webhook = async (req) => {
  const { db } = req;
  const courier_id = req.query?.courier_id || req.body?.courier_id;

  const record = await get_schema(db, COLLECTIONS.webhook, courier_id);
  if (!record)
    return { ok: false, message: "No webhook schema set for this courier" };

  return { ok: true, message: "Webhook schema retrieved", data: record };
};

// ---------------------------------------------------------------- secrets -
const add_courier_secrets = async (req) => {
  const { db, body } = req;
  const { courier_id, secrets } = body || {};

  if (!courier_id) return { ok: false, message: "courier_id is required" };

  const courier = await get_courier_by_id(db, courier_id);
  if (!courier) return { ok: false, message: "Courier not found" };

  const { errors } = validate_secrets(secrets);
  if (errors.length) {
    return { ok: false, message: "Invalid secrets config", data: { errors } };
  }

  const { created } = await upsert_courier_secrets(db, courier_id, secrets);

  return {
    ok: true,
    message: created ? "Secrets created" : "Secrets updated",
    data: { courier_id },
  };
};

const get_courier_secrets_handler = async (req) => {
  const { db } = req;
  const courier_id = req.query?.courier_id || req.body?.courier_id;

  if (!courier_id) return { ok: false, message: "courier_id is required" };

  const secrets = await get_courier_secrets(db, courier_id);
  if (!secrets) {
    return { ok: false, message: "No secrets set for this courier" };
  }

  return {
    ok: true,
    message: "Secrets retrieved",
    data: { courier_id, secrets },
  };
};

export {
  add_courier_auth,
  get_courier_auth,
  add_courier_estimate,
  get_courier_estimate,
  add_courier_create_delivery,
  get_courier_create_delivery,
  add_courier_webhook,
  get_courier_webhook,
  add_courier_secrets,
  get_courier_secrets_handler as get_courier_secrets,
};
