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

  let estimates = await (await db.folder("Estimates"))
    .find({ _id: { $in: orders.map((or) => or.estimate_id) } })
    .toArray();

  orders.map((order) => {
    order.courier_estimate = estimates.find(
      (es) => es._id === order.estimate_id,
    );
    if (order.courier_estimate) {
      order.courier_estimate =
        order.courier_estimate?.estimates?.[order.courier];

      if (order.courier_estimate) {
        order.courier_estimate = {
          total_price: order.courier_estimate.total_price,
          duration: order.courier_estimate.duration,
        };
      }
    }
  });

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

  let estimate = await (
    await db.folder("Estimates")
  ).findOne({ _id: order.estimate_id });

  order.courier_estimate = estimate;
  if (order.courier_estimate) {
    order.courier_estimate = order.courier_estimate?.estimates?.[order.courier];

    if (order.courier_estimate) {
      order.courier_estimate = {
        total_price: order.courier_estimate.total_price,
        duration: order.courier_estimate.duration,
      };
    }
  }

  return {
    ok: !!_id,
    message: _id ? "Order retrieved" : "Order not found",
    data: order,
  };
};

export { history, get_order };
