import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  let Coll = await db.collection("Wallets");

  console.log(
    await Coll.findOne(
      { _id: "577e9125-d8a9-4f6e-9372-f177a982685b" },
      { $set: { balance: 500_000 } },
    ),
  );
};

export { boots };
