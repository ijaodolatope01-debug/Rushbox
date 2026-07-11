import {
  confirm_phone_update,
  create_api_key,
  delete_key,
  email_signin,
  request_otp,
  retrieve_keys,
  signin,
  update_email,
  update_phone,
} from "../handlers/v2/auth.js";
import { create_delivery } from "../handlers/v2/delivery.js";
import { get_order, history } from "../handlers/v2/history.js";
import { fetch_estimates } from "../handlers/v2/order_estimate.js";
import { add_review, get_reviews } from "../handlers/v2/reviews.js";
import { user } from "../handlers/v2/user.js";
import { get_wallet, transactions } from "../handlers/v2/wallets.js";

const router = {
  user: {
    handler: user,
    security: "auth_token",
  },
  // Auth routes
  signin: {
    handler: signin,
    security: "api_key",
    schema: {
      body: {
        phone: { type: "string", required: true },
        code: { type: "string", required: true },
      },
    },
  },

  request_otp: {
    handler: request_otp,
    security: "api_key",
    schema: {
      body: {
        phone: { type: "string", required: true },
      },
    },
  },

  email_signin: {
    handler: email_signin,
    security: "api_key",
    schema: {
      body: {
        social: {
          type: "object",
          required: true,
        },
      },
    },
  },

  update_email: {
    handler: update_email,
    security: "auth_token",
    schema: {
      body: {
        social: { type: "object", required: true },
      },
    },
  },

  create_api_key: {
    handler: create_api_key,
    security: "auth_token",
    schema: {
      body: {
        name: { type: "string", required: true },
      },
    },
  },
  retrieve_keys: {
    handler: retrieve_keys,
    security: "auth_token",
    schema: {
      body: {},
    },
  },
  delete_key: {
    handler: delete_key,
    security: "auth_token",
    schema: {
      body: {
        name: { type: "string", required: true },
      },
    },
  },
  update_phone: {
    handler: update_phone,
    security: "auth_token",
    schema: {
      body: {
        phone: { type: "string", required: true },
      },
    },
  },
  confirm_phone_update: {
    handler: confirm_phone_update,
    security: "auth_token",
    schema: {
      body: {
        phone: { type: "string", required: true },
        code: { type: "string", required: true },
      },
    },
  },

  // Delivery routes
  create_delivery: {
    handler: create_delivery,
    security: "auth_token",
    schema: {
      body: {
        courier: { type: "string", required: true },
        details: { type: "object", required: true },
        payment_reference: { type: "string" },
      },
    },
  },

  // History routes
  history: {
    handler: history,
    security: "auth_token",
    schema: {
      body: {
        status: { type: "string" },
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },

  get_order: {
    handler: get_order,
    security: "auth_token",
    schema: {
      body: {
        _id: { type: "string", required: true },
      },
    },
  },

  // Estimate routes
  fetch_estimates: {
    handler: fetch_estimates,
    security: "auth_token",
    schema: {
      body: {},
    },
  },

  // Reviews routes
  add_review: {
    handler: add_review,
    security: "auth_token",
    schema: {
      body: {
        courier: { type: "string", required: true },
        rating: { type: "number", required: true },
        orderid: { type: "string", required: true },
        comment: { type: "string" },
      },
    },
  },

  get_reviews: {
    handler: get_reviews,
    security: "auth_token",
    schema: {
      body: {
        courier: { type: "string", required: true },
        page: { type: "number", default_value: 1 },
        limit: { type: "number", default_value: 20 },
      },
    },
  },

  // Wallet routes
  get_wallet: {
    handler: get_wallet,
    security: "auth_token",
    schema: {
      body: {},
    },
  },

  transactions: {
    handler: transactions,
    security: "auth_token",
    schema: {
      body: {
        page: { type: "number", default_value: 1 },
        limit: { type: "number", default_value: 20 },
      },
    },
  },
};

export default router;
