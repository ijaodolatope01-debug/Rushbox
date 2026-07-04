import crypto from "crypto";
import { DEVICE_TOKENS } from "../../ds/folders.js";

export const addDeviceToken = async (userId, token) => {
  const Tokens = await DEVICE_TOKENS();

  // generate an id that will be used if a new doc is inserted
  const generatedId = crypto.randomUUID();

  const filter = { user: userId };
  const update = {
    $addToSet: { tokens: token },
    $setOnInsert: { _id: generatedId, createdAt: new Date() },
  };
  const options = { upsert: true };

  const res = await Tokens.updateOne(filter, update, options);

  // determine the _id used for the document
  let docId = null;
  if (res?.upsertedId) {
    // modern drivers return upsertedId
    docId = res.upsertedId._id ?? res.upsertedId;
  } else {
    // existing doc: fetch its _id (fallback)
    const doc = await Tokens.findOne(filter, { projection: { _id: 1 } });
    docId = doc?._id ?? generatedId;
  }

  return { result: res, _id: docId };
};
// ...existing code...

export const getDeviceTokens = async (userId) => {
  const Tokens = await DEVICE_TOKENS();
  const record = await Tokens.findOne({ user: userId });
  return record?.tokens || [];
};

export const removeDeviceToken = async (userId, token) => {
  const Tokens = await DEVICE_TOKENS();
  await Tokens.updateOne({ user: userId }, { $pull: { tokens: token } });
};
