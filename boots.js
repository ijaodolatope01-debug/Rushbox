import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  console.log(
    JSON.stringify(
      await (await db.collection("Orders"))
        .find({ _id: "e5100a1c-a551-4a9c-a8e4-cc43abcdb6f1" })
        .toArray(),
      null,
      2,
    ),
  );
};

export { boots };
