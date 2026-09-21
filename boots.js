import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  const repo = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  // console.log(await (await repo.collection("$CACHE-auth")).find().toArray());
};

export { boots };
