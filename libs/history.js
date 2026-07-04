import { authenticate_fez } from "./utils/couriers.js";

const get_courier_status = async (order) => {
  let status = "ongoing";
  let key = order?.courier_key;

  if (order.courier === "fez") {
    if (!key) {
      let res = order.courier_response;
      let reskey = res?.orderNos ? Object.keys(res.orderNos) : [];
      key = reskey.length ? res.orderNos[reskey[0]] : null;
    }
    if (!key) return status;

    let auth = await authenticate_fez();
    try {
      const response = await fetch(
        `https://apisandbox.fezdelivery.co/v1/order/track/${key}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth?.authDetails?.authToken}`,
            "secret-key": process.env.FEZ_TOKEN,
          },
        },
      );

      if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

      const data = await response.json();
      if (data?.status === "Success") {
        if (["Picked-Up", "Dispatched"].includes(data?.order?.orderStatus)) {
          status = "completed";
        }
      }
    } catch (err) {
      console.error("Error:", err);
    }
  } else if (order.courier === "dellyman") {
    let res = await fetch("https://dev.dellyman.com/api/v3.0/TrackOrder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
      },
      body: JSON.stringify({
        TrackingID: order.courier_response.TrackingID,
      }),
    });
    res = await res.json();
    if (res?.OrderStatus === "PENDING") {
      status = status;
    } else if (res?.OrderStatus === "ASSIGNED") {
      status = "completed";
    }
  } else if (order.courier === "kwik") {
    if (!key) {
      key = order.courier_response.unique_order_id;
    }
    try {
      let response = await fetch(order.courier_response.job_status_check_link, {
        method: "GET",
      });

      if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

      let data = await response.text();
      data = data.split(",");
      if (data && data[0] === "ARRIVED") {
        status = "completed";
      } else {
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (order.courier === "errandlr") {
  } else if (order.courier === "chowdeck") {
  } else if (order.courier === "kwikpik") {
    try {
      let res = await fetch(
        `https://api.kwikpik.io/partners/requests/${order.courier_key}`,
      );
      res = await res.json();
      if (res?.result) {
        if (res.result?.request?.status === "COMPLETED") {
          status = "completed";
        }
      }
    } catch (e) {}
  }

  return status;
};

const update_status_of_ongoing_orders = async (user_id, req) => {
  let { db } = req;

  // Ongoing orders collection
  let Orders = await db.folder("Orders");
  // Read all Orders orders
  let ongoing_orders = await Orders.find({ user: user_id, status: "ongoing" })
    .sort({ _id: -1 })
    .toArray();

  // Iterate through the orders and query for their current status
  for (let o = 0; o < ongoing_orders.length; o++) {
    let order = ongoing_orders[o];

    // Querying for their current status
    let stat = await get_courier_status(order);

    // i.e the order have been updated from the courier
    if (stat !== "ongoing") {
      // We set the order status
      order.status = stat;
      // We insert it into the user `status` collection
      await Orders.updateOne(
        { _id: order._id },
        { $set: { status: stat, [stat]: new Date().toISOString() } },
      );
    }
  }
};

const normalise_order = (o) => {
  let nrm = o?.norm;
  if (!nrm) return o;

  nrm.order_status = o.status;
  nrm.order_id = o._id;
  nrm.created = o.created;
  nrm.ongoing_status = o.ongoing_status;
  nrm.tracking = o.tracking;

  if (nrm.delivery_fare) {
    let delivery_fare = nrm.delivery_fare,
      charge = delivery_fare > 600 ? 500 : 300;

    nrm.fare = {
      original: delivery_fare - charge,
      charge,
      total: delivery_fare,
    };
  }

  delete nrm.delivery_fare;

  return nrm;
};

export { get_courier_status, update_status_of_ongoing_orders, normalise_order };
