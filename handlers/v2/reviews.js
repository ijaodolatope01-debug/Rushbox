const get_courier_ratings = async (courier, db) => {
  if (!courier) {
    return;
  }

  const Reviews = await db.folder("Reviews");
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

const add_review = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  const { courier, rating, orderid, comment } = body;

  if (!courier || !rating) {
    return {
      ok: false,
      status: 401,
      message: "Courier and rating are required",
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

export { add_review, get_reviews, get_courier_ratings };
