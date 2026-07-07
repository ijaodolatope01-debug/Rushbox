const register_webhook = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;
  let { url } = req;

  let _id = crypto.randomUUID();
  await (
    await db.folder("Webhooks")
  ).insertOne({ url, profile: profile._id, _id, created: Date.now() });

  return {
    ok: false,
    message: "Webhook updated",
    data: {
      url,
      _id,
    },
  };
};

const remove_webhook = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;

  const res = await (
    await db.folder("Webhooks")
  ).deleteOne({ profile: profile._id });

  let ok = !!(res && res.deletedCount && res.deletedCount > 0);
  return {
    ok,
    message: ok ? "Webhook deleted" : "Nothing happened",
  };
};

export { register_webhook, remove_webhook };
