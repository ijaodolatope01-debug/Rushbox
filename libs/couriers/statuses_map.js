const STATUSES_MAPS = {
  chowdeck: {
    ORDER_CREATED: 2, // created → assigning
    ORDER_ASSIGNED: 4, // assigned → coming to pickup
    ORDER_AWAITING_PICKUP: 5, // arrived at pickup
    ORDER_PICKED_UP: 7, // confirmed pickup → on way to drop-off
    ORDER_ARRIVED_AT_CUSTOMER_LOCATION: 8, // arrived at drop-off
    ORDER_COMPLETE: 10, // dropped → completed
  },

  kwikpik: {
    PENDING: 2,
    RECEIVED: 2,
    DISPATCHED_TO_LOCATION: 2,
    IN_TRANSIT_TO_LOCATION: 2,
    RECEIVED_AT_LOCATION: 2,
    CONFIRMED: 2,

    AWAITING_PICKUP: 4, // assigned → coming to pickup
    ACCEPTED: 4,

    ARRIVED_PICKUP: 5, // arrived at pickup
    PICKED_UP: 6, // confirmed the pick-up

    IN_TRANSIT: 7, // on way to drop-off
    ARRIVED_DESTINATION: 8, // arrived at drop-off
    OUT_FOR_DELIVERY: 8,

    COMPLETED: 10, // dropped → completed
    DELIVERED: 10,

    FAILED: -2,
    RETURN_INITIATED: -3,
    RETURN_IN_TRANSIT: -3,
    RETURNED_TO_LOCATION: -4,
    CANCELLED: -1,
  },

  errandlr: {
    created: 2, // created → assigning
    accepted: 4, // assigned → coming to pickup
    collected: 7, // arrived pickup → confirmed → on way
    completed: 10, // arrived drop-off → dropped → completed
    closed: 10,
  },

  dellyman: {
    PENDING: 2, // created → assigning
    ASSIGNED: 3, // rider has been assigned
    INTRANSIT: 4, // coming to pickup
    COMPLETED: 10, // arrived pickup → confirmed → on way → arrived drop-off → dropped → completed
    CANCELLED: -1,
    RETURNED: -4,
  },

  kwik: {
    UNASSIGNED: 2,
    UPCOMING: 2,
    ACCEPTED: 4, // assigned → coming to pickup
    ARRIVED: 5, // arrived at pickup
    STARTED: 7, // confirmed pickup → on way to drop-off
    ENDED: 10, // arrived drop-off → dropped → completed
    FAILED: -2,
    CANCEL: -1,
  },

  // Fez has no statuses defined in the PDF
  fez: {},
};

const STATUSES_MESSAGE = {
  1: "Your order has been created",
  2: "Rider is being assigned",
  3: "Rider has been assigned",
  4: "Rider coming to pickup your package",
  5: "Rider Arrived at Pickup",
  6: "Rider has confirmed the pick-up",
  7: "Rider on way to Drop-off",
  8: "Rider arrived at Drop-off",
  9: "Rider dropped the package",
  10: "Order Completed Successfully",

  // New negative statuses from the PDF
  "-1": "Order cancelled",
  "-2": "Delivery failed",
  "-3": "Order being returned",
  "-4": "Order Returned",
};

export default STATUSES_MAPS;
export { STATUSES_MESSAGE };
