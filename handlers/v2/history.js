import {
  normalise_order,
  update_status_of_ongoing_orders,
} from "../../libs/history.js";

const history = async (req) => {
  let { body, headers, db } = req;
  let { status, limit, page } = body;

  let { profile } = headers;
  let user_id = profile?._id;

  let skip = (page - 1) * limit;

  let orders = [];

  if (!skip) await update_status_of_ongoing_orders(user_id, req);

  let Orders = await db.folder("Orders");

  orders = await Orders.find({ user_id, status })
    .sort({ created: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  let total = await Orders.countDocuments();

  orders = orders.map((o) => {
    return normalise_order(o);
  });

  if (orders.length) {
    const revColl = await db.folder("Reviews");

    const ids = orders.map((o) => o.order_id);
    const revs = await revColl.find({ orderid: { $in: ids } }).toArray();
    const revMap = revs.reduce((m, r) => {
      m[r.orderid] = r;
      return m;
    }, {});
    orders = orders.map((o) => ({ ...o, review: revMap[o.order_id] || null }));
  }

  return {
    ok: true,
    data: orders,
    pagination: {
      page: skip / limit + 1,
      pages: Math.ceil(total / limit),
      skip,
      limit,
      total,
    },
  };
};

const get_order = async (req) => {
  let { body, headers, db } = req;
  let { _id } = body;

  let Orders = await db.folder("Orders");

  let order = await Orders.findOne({ _id });
  if (order) {
    order = normalise_order(order);
    order.review = await (await db.folder("Reviews")).findOne({ orderid: _id });
  }

  return {
    ok: !!_id,
    message: _id ? "Order retrieved" : "Order not found",
    data: order,
  };
};

export { history, get_order };
