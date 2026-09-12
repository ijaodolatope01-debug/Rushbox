import { fetch_estimates } from "../handlers/v3/estimates.js";
import { add_courier, get_couriers } from "../handlers/v3/couriers.js";
import {
  add_courier_auth,
  get_courier_auth,
  add_courier_estimate,
  get_courier_estimate,
  add_courier_create_delivery,
  get_courier_create_delivery,
  add_courier_webhook,
  get_courier_webhook,
  add_courier_secrets,
  get_courier_secrets,
} from "../handlers/v3/courier_api.js";

const router = {
  // Courier setup
  add_courier: {
    handler: add_courier,
    security: "api_key",
    schema: {
      body: {
        name: { type: "string", required: true },
        base_url: { type: "string", required: true },
        staging_base_url: { type: "string" },
      },
    },
  },
  get_couriers: {
    handler: get_couriers,
    security: "api_key",
    schema: {
      query: {
        page: { type: "number", default_value: 1 },
        limit: { type: "number", default_value: 20 },
      },
      body: {
        filter: { type: "string" },
      },
    },
  },

  // Courier auth schema
  add_courier_auth: {
    handler: add_courier_auth,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
        auth: { type: "object", required: true },
      },
    },
  },
  get_courier_auth: {
    handler: get_courier_auth,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
      },
    },
  },

  // Courier estimate schema
  add_courier_estimate: {
    handler: add_courier_estimate,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
        estimate: { type: "object", required: true },
      },
    },
  },
  get_courier_estimate: {
    handler: get_courier_estimate,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
      },
    },
  },

  // Courier create_delivery schema
  add_courier_create_delivery: {
    handler: add_courier_create_delivery,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
        create: { type: "object", required: true },
      },
    },
  },
  get_courier_create_delivery: {
    handler: get_courier_create_delivery,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
      },
    },
  },

  // Courier webhook schema
  add_courier_webhook: {
    handler: add_courier_webhook,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
        webhook: { type: "object", required: true },
      },
    },
  },
  get_courier_webhook: {
    handler: get_courier_webhook,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
      },
    },
  },

  // Courier secrets (one encrypted map per courier)
  add_courier_secrets: {
    handler: add_courier_secrets,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
        secrets: { type: "object", required: true },
      },
    },
  },
  get_courier_secrets: {
    handler: get_courier_secrets,
    security: "api_key",
    schema: {
      body: {
        courier_id: { type: "string", required: true },
      },
    },
  },

  fetch_estimates: {
    handler: fetch_estimates,
    security: "auth_token",
    schema: {
      body: {},
    },
  },
};

export default router;
