const STATUSES_MAPS = {
  errandlr: {
    CREATED: 2,
    ACCPETED: 4,
    COLLECTED: 7,
    COMPLETED: 10,
    CLOSED: 10,
  },
  dellyman: {
    PENDING: 2,
    INTRANSIT: 4,
    COMPLETED: 10,
    CANCELLED: -1,
  },
  kwikpik: {
    PENDING: 2,
    CONFIRMED: 2,
    ACCPETED: 4,
    PICKED_UP: 5,
    IN_TRANSIT: 7,
    ARRIVED_DESTINATION: 8,
    COMPLETED: 10,
    CANCELLED: -1,
  },
  chowdeck: {
    ORDER_CREATED: 2,
    ORDER_ASSIGNED: 4,
    ORDER_AWAITING_PICKUP: 5,
    ORDER_PICKED_UP: 7,
    ORDER_ARRIVED_AT_CUSTOMER_LOCATION: 8,
    ORDER_COMPLETE: 10,
  },
  kwik: {
    UNASSIGNED: 2,
    UPCOMING: 2,
    ACCEPTED: 4,
    ARRIVED: 6,
    STARTED: 7,
    ENDED: 10,
    FAILED: -2,
    CANCEL: -1,
  },
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
};

export default STATUSES_MAPS;
export { STATUSES_MESSAGE };
