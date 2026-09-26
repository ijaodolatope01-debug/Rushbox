import { Mongo } from "@godprotocol/repositories";
import crypto from "crypto";

const boots = async () => {
  // return;
  const repo = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  // return;
  let fold = await (
    await repo.collection("Orders")
  )
    //.find({ _id: "0272b7e3-7bc0-4881-a679-69503c50f917" })
    .find({ courier_key: "462906" })
    .toArray();

  console.log(fold);

  // console.log(
  //   crypto
  //     .createHmac("sha256", process.env.DELLYMAN_WEBHOOK_SECRET_TEST)
  //     .update(fold[0].raw_body)
  //     .digest("hex"),
  // );
};

export { boots };
