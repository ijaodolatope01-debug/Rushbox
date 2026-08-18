import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  console.log(
    await (await db.collection("Courier_webhook")).find({}).toArray(),
  );
};

export { boots };
