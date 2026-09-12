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

  // normalize distribution to keys 1..5.
  // `rating` is validated as an integer 1-5 on write now (see add_review),
  // but this stays defensive against any pre-existing/legacy records that
  // slipped in with a non-integer or out-of-range value (e.g. 3.3, 2.7) —
  // those get rounded and clamped into the nearest real bucket instead of
  // spawning their own key alongside 1..5.
  const distMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((d) => {
    if (!d || d._id == null) return;
    const bucket = Math.min(5, Math.max(1, Math.round(Number(d._id))));
    distMap[bucket] = (distMap[bucket] || 0) + d.count;
  });

  return {
    total: s.total,
    avg: Number((s.avgRating || 0).toFixed(2)),
    min: s.minRating,
    max: s.maxRating,
    distribution: distMap,
  };
};

export { get_courier_ratings };
