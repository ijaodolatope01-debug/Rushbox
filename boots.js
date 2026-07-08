import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  let Coll = await db.collection("Rus:continuation_tokens");

  console.log(await Coll.deleteMany({ phone }));
};

export { boots };
