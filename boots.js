import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  const latest = await (await db.collection("Event_logs"))
    .find()
    .sort({ _id: -1 })
    .limit(1)
    .next();
  console.log(latest);

  console.log(
    await (
      await db.collection("Payment_refs")
    ).findOne({ _id: "a699d03f-e6dd-456c-99ea-c8848dede3fc" }),
  );
};

export { boots };
