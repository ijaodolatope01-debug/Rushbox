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
import {
  create_delivery,
  get_payment_url,
  retrieve_order_by_reference,
} from "../handlers/v2/delivery.js";
import { get_order, history } from "../handlers/v2/history.js";
import { fetch_estimates } from "../handlers/v2/order_estimate.js";
import {
  add_review,
  courier_stats,
  get_reviews,
} from "../handlers/v2/reviews.js";
import {
  confirm_delete_account,
  delete_account,
  user,
} from "../handlers/v2/user.js";
import {
  register_webhook,
  remove_webhook,
  retrieve_webhook,
} from "../handlers/v2/user_webhook.js";
import {
  add_bank_account,
  delete_bank_account,
  get_bank_accounts,
  get_banks,
  get_wallet,
  transactions,
  withdraw,
} from "../handlers/v2/wallets.js";
import {
  courier_webhook,
  paystack_webhook_events_listener,
} from "../handlers/v2/webhook.js";

const router = {
  user: {
    handler: user,
    security: "auth_token",
    schema: {
      body: {},
    },
  },
  delete_account: {
    handler: delete_account,
    security: "auth_token",
    schema: { body: {} },
  },
  confirm_delete_account: {
    handler: confirm_delete_account,
    security: "auth_token",
    schema: {
      body: {
        phone: { type: "string", required: true },
        code: { type: "string", required: true },
      },
    },
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
  get_payment_url: {
    handler: get_payment_url,
    security: "auth_token",
    schema: {
      body: {
        estimate_id: { type: "string", required: true },
        delivery_details: { type: "object", required: true },
        product_price: { type: "number", default_value: 0 },
      },
    },
  },
  retrieve_order_by_reference: {
    handler: retrieve_order_by_reference,
    security: "auth_token",
    schema: {
      body: {
        payment_reference: { type: "string", required: true },
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

  courier_stats: {
    handler: courier_stats,
    security: "auth_token",
    schema: {
      body: {
        courier: { type: "string", required: true },
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

  get_banks: {
    handler: get_banks,
    security: "auth_token",
  },

  add_bank_account: {
    handler: add_bank_account,
    security: "auth_token",
    schema: {
      body: {
        account_number: { type: "string", required: true },
        bank_code: { type: "string", required: true },
      },
    },
  },

  withdraw: {
    handler: withdraw,
    security: "auth_token",
    schema: {
      body: {
        amount: { type: "number", required: true },
        bank_account_id: { type: "string", required: true },
        reason: { type: "string", required: false },
      },
    },
  },

  delete_bank_account: {
    handler: delete_bank_account,
    security: "auth_token",
    schema: {
      body: {
        bank_account_id: { type: "string", required: true },
      },
    },
  },

  get_bank_accounts: {
    handler: get_bank_accounts,
    security: "auth_token",
  },

  // Webhooks
  paystack_webhook_events_listener: {
    handler: paystack_webhook_events_listener,
    security: "none",
    schema: { body: {} },
  },

  // Courier webhook
  // "courier_webhook/:courier": {
  //   handler: courier_webhook,
  //   security: "none",
  //   schema: { body: {} },
  // },

  "courier_webhook/:courier": {
    handler: courier_webhook,
    security: "none",
    schema: {
      params: {
        courier: {
          type: "string",
          required: true,
          enum: ["dhl", "dellyman", "fedex", "paystack"],
        },
      },
      query: {
        signature: { type: "string", default_value: "bimpe" },
      },
      body: {},
    },
  },

  // User webhook
  register_webhook: {
    handler: register_webhook,
    schema: {
      body: {
        url: { type: "string", required: true },
      },
    },
  },
  remove_webhook: {
    handler: remove_webhook,
  },
  retrieve_webhook: {
    handler: retrieve_webhook,
  },
};

export default router;
