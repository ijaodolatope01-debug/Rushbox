import { get_courier_ratings } from "../../libs/ratings.js";

const courier_stats = async (req) => {
  let { body, db, headers } = req;
  let { courier } = body;

  let Orders = await db.folder("Orders");

  let res = await Orders.countDocuments({ courier });

  return {
    ok: true,
    data: {
      total_orders: res,
    },
  };
};

const add_review = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  const { courier, orderid, comment } = body;

  // `rating` used to go straight into the DB with no validation, which is
  // how fractional values like 3.3/2.7 ended up in Reviews and then leaked
  // into the distribution buckets as their own keys instead of 1..5.
  const rating = Number(body.rating);

  if (!courier || !body.rating) {
    return {
      ok: false,
      status: 401,
      message: "Courier and rating are required",
    };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return {
      ok: false,
      status: 400,
      message: "Rating must be a whole number between 1 and 5",
    };
  }

  let rev = {
    courier,
    rating,
    orderid,
    user: profile._id,
    comment: comment || "",
    createdAt: new Date(),
    _id: crypto.randomUUID(),
  };

  await (await db.folder("Reviews")).insertOne(rev);

  return {
    ok: true,
    status: 201,
    message: "Review added successfully",
    data: rev,
  };
};

const get_reviews = async (req) => {
  let { body, headers, db } = req;
  const { courier, page = 1, limit = 20 } = body;

  if (!courier) {
    return { message: "Courier is required", ok: false, status: 400 };
  }

  const reviews = await (
    await db.folder("Reviews")
  )
    .find({ courier })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return {
    ok: true,
    message: "Reviews retrieved successfully",
    data: { reviews, ratings: await get_courier_ratings(courier, db) },
  };
};

export { add_review, get_reviews, get_courier_ratings, courier_stats };
