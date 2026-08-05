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
    ).findOne({ _id: "912d33e0-a04f-4b6b-9e8e-b0425194853b" }),
  );
};

export { boots };
