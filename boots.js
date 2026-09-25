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

  // console.log(
  //   crypto
  //     .createHmac("sha256", process.env.DELLYMAN_WEBHOOK_SECRET_TEST)
  //     .update(fold[0].raw_body)
  //     .digest("hex"),
  // );
  console.log(JSON.parse(fold[0].raw_body), fold[0].raw_body);
};

export { boots };
