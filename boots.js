import { Mongo } from "@godprotocol/repositories";

const boots = async () => {
  const repo = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "rushbox",
  });

  // console.log(
  //   await (
  //     await repo.collection("Wallets")
  //   ).updateOne(
  //     { _id: "48158bf4-0a5c-4f07-9140-00ac96b17579" },
  //     { $inc: { balance: 1000000 } },
  //   ),
  // );
};

export { boots };
