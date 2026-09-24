import { Mongo } from "@godprotocol/repositories";
import crypto from "crypto";

const boots = async () => {
  return;
  const repo = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  const payload = await (await repo.collection("Webhook_payload"))
    .find({ "body.category": "ORDER_ASSIGNED" })
    .limit(1)
    .toArray();

  const webhook = payload[0];

  const body = JSON.stringify(webhook.body);

  const signature = crypto
    .createHmac("sha256", process.env.CHOWDECK_TOKEN)
    .update(body)
    .digest("hex");

  console.log(body);

  console.log({
    generated: signature,
    expected:
      "a8f1cb4a8bbaef208a5854de26e4ff473a0892f14428454e06854180a7c032b1",
    matches:
      signature ===
      "a8f1cb4a8bbaef208a5854de26e4ff473a0892f14428454e06854180a7c032b1",
  });
};

export { boots };
