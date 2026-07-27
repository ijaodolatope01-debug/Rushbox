import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  let Coll = await db.collection("Wallets");

  // console.log(
  //   await Coll.findOne(
  //     { _id: "ec562f63-c295-408a-9d70-b070aa310612" },
  //     // { $set: { balance: 500_000_000_000 } },
  //   ),
  // );
};

export { boots };
