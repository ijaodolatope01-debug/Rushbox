import crypto from "crypto";

const retrieve_webhook = async (req) => {
  let { db, headers } = req;
  let { profile } = headers;

  const webhook = await (
    await db.folder("Webhooks")
  ).findOne({
    profile: profile._id,
  });

  if (!webhook) {
    return {
      ok: false,
      message: "Webhook not found",
    };
  }

  const secret = webhook.secret || "";

  const masked_secret =
    secret.length > 8
      ? `${secret.slice(0, 4)}${"•".repeat(secret.length - 8)}${secret.slice(-4)}`
      : "••••••••";

  return {
    ok: true,
    message: "Webhook retrieved",
    data: {
      _id: webhook._id,
      url: webhook.url,
      secret: masked_secret,
      created: webhook.created,
      updated: webhook.updated,
    },
  };
};

const register_webhook = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;
  let { url } = body;

  const _id = crypto.randomUUID();

  // Cryptographically secure webhook secret
  const secret = crypto.randomBytes(32).toString("hex");

  await (
    await db.folder("Webhooks")
  ).updateOne(
    { profile: profile._id },
    {
      $set: {
        url,
        secret,
        updated: Date.now(),
      },
      $setOnInsert: {
        _id,
        created: Date.now(),
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    message: "Webhook registered",
    data: {
      url,
      _id,
      secret,
    },
  };
};

const remove_webhook = async (req) => {
  let { db, headers } = req;
  let { profile } = headers;

  const res = await (
    await db.folder("Webhooks")
  ).deleteOne({
    profile: profile._id,
  });

  const ok = !!(res && res.deletedCount && res.deletedCount > 0);

  return {
    ok,
    message: ok ? "Webhook deleted" : "Nothing happened",
  };
};

export { register_webhook, remove_webhook, retrieve_webhook };
