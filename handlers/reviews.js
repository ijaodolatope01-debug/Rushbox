import { REVIEWS } from "../ds/folders.js";

const get_courier_ratings = async (courier) => {
  if (!courier) {
    return;
  }

  const Reviews = await REVIEWS();
  const agg = await Reviews.aggregate([
    { $match: { courier } },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              avgRating: { $avg: "$rating" },
              minRating: { $min: "$rating" },
              maxRating: { $max: "$rating" },
            },
          },
          { $project: { _id: 0 } },
        ],
        distribution: [
          { $group: { _id: "$rating", count: { $sum: 1 } } },
          { $sort: { _id: -1 } },
        ],
      },
    },
  ]).toArray();

  const { summary = [], distribution = [] } = agg[0] || {};
  const s = summary[0] || {
    total: 0,
    avgRating: 0,
    minRating: null,
    maxRating: null,
  };

  // normalize distribution to keys 1..5
  const distMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((d) => {
    if (d && d._id != null) distMap[String(d._id)] = d.count;
  });

  return {
    total: s.total,
    avg: Number((s.avgRating || 0).toFixed(2)),
    min: s.minRating,
    max: s.maxRating,
    distribution: distMap,
  };
};

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
  const { courier, page = 1, limit = 20 } = req.body;

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
    data: { reviews, ratings: await get_courier_ratings(courier) },
  });
};

export { add_review, get_reviews, get_courier_ratings };
