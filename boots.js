import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  console.log(
    JSON.stringify(
      await (await db.collection("Courier_webhook")).find({}).toArray(),
      null,
      2,
    ),
  );
};

export { boots };
