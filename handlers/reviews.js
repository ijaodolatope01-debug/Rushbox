import { REVIEWS } from "../ds/folders.js";

const add_review = async (req, res) => {
  const { courier, rating, orderid, comment } = req.body;

  if (!courier || !rating) {
    return res.status(400).json({ error: "Courier and rating are required" });
  }

  await (
    await REVIEWS()
  ).insertOne({
    courier,
    rating,
    orderid,
    comment: comment || "",
    createdAt: new Date(),
  });
  // Here you would typically save the review to a database
  // For this example, we'll just return a success message

  return res.status(201).json({
    message: "Review added successfully",
    review: {
      courier,
      rating,
      comment: comment || "",
    },
  });
};

const get_reviews = async (req, res) => {
  const { courier } = req.query;

  if (!courier) {
    return res.status(400).json({ error: "Courier is required" });
  }

  const reviews = await (await REVIEWS()).find({ courier }).toArray();

  return res.status(200).json({
    message: "Reviews retrieved successfully",
    reviews,
  });
};

export { add_review, get_reviews };
