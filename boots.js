import { Mongo } from "@godprotocol/repositories";
import crypto from "crypto";

const boots = async () => {
  return;
  const repo = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  let fold = await (await repo.collection("Dellyman_webhook"))
    .find({})
    .toArray();

  console.log(JSON.stringify(fold, null, 2));
};

export { boots };
