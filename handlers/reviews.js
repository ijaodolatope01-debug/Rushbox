import { REVIEWS } from "../ds/folders.js";

const add_review = async (req, res) => {
  const { courier, rating, orderid, comment } = req.body;

  if (!courier || !rating) {
    return res.status(400).json({ error: "Courier and rating are required" });
  }

  let rev = {
    courier,
    rating,
    orderid,
    comment: comment || "",
    createdAt: new Date(),
    _id: crypto.randomUUID(),
  };

  await (await REVIEWS()).insertOne(rev);
  // Here you would typically save the review to a database
  // For this example, we'll just return a success message

  return res.status(201).json({
    ok: true,
    message: "Review added successfully",
    data: rev,
  });
};

const get_reviews = async (req, res) => {
  const { courier, page, limit } = req.body;

  if (!courier) {
    return res.status(400).json({ error: "Courier is required" });
  }

  const reviews = await (
    await REVIEWS()
  )
    .find({ courier })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return res.status(200).json({
    ok: true,
    message: "Reviews retrieved successfully",
    reviews,
  });
};

export { add_review, get_reviews };
