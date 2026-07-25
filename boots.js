import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  let Coll = await db.collection("$CACHE-auth");

  console.log(await Coll.deleteMany({}));
};

export { boots };
