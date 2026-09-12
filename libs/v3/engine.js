import crypto from "crypto";
import Orders_update from "./ongoing_status.js";
import { debug } from "../../handlers/v2/delivery.js";
import { thirty_mins } from "../estimates.js";

/**
 * ============================================================
 * SCHEMA — every field is a plain descriptor object (JSON-safe).
 * ============================================================
 *
 * LEAF DESCRIPTOR:
 * {
 *   from, source: "input"|"computed"|"secret",   // default "input"
 *   const,                                        // literal, skips everything else
 *   secret_ref, staging_secret_ref,               // only when source: "secret"
 *   fallback,                                     // 2nd `from` path (same source) if empty
 *   default_computed,                             // COMPUTED key used if still empty
 *   default,                                      // literal used if still empty
 *   split, index,                                 // "a.b.c".split(split)[index]
 *   join: { fields, separator },                  // fields.map(f => get(source, f)).join(separator)
 *   dynamic_key: { parent, key_from },            // response[parent][request[key_from]]
 *   transform, type, prefix,                      // applied in this order
 *   required
 * }
 *
 * OBJECT NODE:   { type: "object", schema: { key: <node>, ... } }
 * ARRAY NODE:    { type: "array", single_item: true, items: { type:"object", schema:{...} } }
 *                single_item: false -> `from` points at a real input array, `items` per element
 *
 * A courier's request BODY is either:
 *   body_map   — object of leaves (existing couriers), or
 *   body_root  — a single node of any type, for bodies that are an array
 *                at the top level (Fez sends `[ {...} ]`, not `{...}`).
 *
 * AUTH:
 * auth: {
 *   login?: { path, method, body_map, extract },  // optional — POSTs, result kept as computed.auth
 *   headers?: { <HeaderName>: <leaf>, ... }        // leaves may read from computed.auth or a secret
 * }
 * If `auth.login` exists but `auth.headers` doesn't, the login result is
 * still resolved and exposed as `computed.auth.*` inside the request BODY —
 * this is how Kwik puts `access_token`/`vendor_id` into its JSON body
 * instead of a header.
 *
 * SECRETS:
 * Any leaf with `secret_ref` (and optionally `staging_secret_ref`) is
 * resolved against `config.secrets` — a plain `{ [key]: value }` map that
 * store.js's get_full_courier/get_all_full_couriers already fetched and
 * decrypted from the Secrets collection before handing this config to
 * runEstimate/runCreate/runWebhook. engine.js never reads the db itself for
 * this; `secret()` just checks `config.secrets[key]` and falls back to
 * `process.env[key]` if that courier hasn't had that particular secret
 * migrated into the db yet. Whatever builds the config object passed in
 * here (get_full_courier, or a hand-built one for tests) is responsible for
 * populating `secrets` — if it's omitted entirely, every secret leaf simply
 * falls through to process.env, same as before secrets moved into the db.
 *
 * WEBHOOK:
 * webhook: {
 *   verify: {
 *     type: "hmac" | "hmac_concat" | "hmac_timestamped_header" | "none",
 *     header, algorithm, secret_ref, staging_secret_ref,
 *     concat_fields?,        // hmac_concat: signs concat_fields.join("") instead of raw JSON body
 *     part_separator?,       // hmac_timestamped_header: splits header into parts (default ",")
 *     kv_separator?,         // hmac_timestamped_header: splits each part into key/value (default "=")
 *     timestamp_key?,        // hmac_timestamped_header: which part holds the timestamp (default "t")
 *     signature_key?,        // hmac_timestamped_header: which part holds the signature (default "v1")
 *     max_skew_seconds?,     // hmac_timestamped_header: reject if the embedded timestamp is older than this
 *     optional?,             // hmac_timestamped_header: if true, a MISSING header is treated as verified
 *                             // (default false — missing header is rejected; this is a deliberately
 *                             // stricter default than "skip verification if absent")
 *   },
 *   replay_protection?: { timestamp_field, max_skew_seconds },  // for hmac/hmac_concat couriers whose
 *                                                                // timestamp lives in a separate body/header field
 *   gate?: [ <check>, ... ],     // ALL must pass or the event is ignored
 *   tracking_id: <leaf>, status_value: <leaf>,
 *   status_map: { RAW_STATUS: ongoing_status_int }
 * }
 * Webhook leaves (tracking_id, status_value, gate, replay_protection,
 * hmac_concat's concat_fields) are resolved against `{ ...req.body, headers: req.headers }`,
 * so a field can come from either the JSON body or a header (e.g. Fez's
 * timestamp lives in `x-timestamp`, not the body) via a path like
 * "headers.x-timestamp". hmac_timestamped_header's timestamp lives INSIDE
 * the signature header itself, so its freshness check (max_skew_seconds) is
 * handled directly in verify_webhook rather than via replay_protection.
 * ============================================================
 */

// ---------- dotted-path get, "$root" = whole object ----------
const get = (obj, path) => {
  if (path == null) return undefined;
  if (path === "$root") return obj;
  return String(path)
    .split(".")
    .reduce(
      (o, key) => (o === undefined || o === null ? undefined : o[key]),
      obj,
    );
};

const TRANSFORMS = {
  strip_ng_prefix: (v) => "0".concat(String(v).slice(4)),
  to_string: (v) => String(v),
  to_number: (v) => Number(v),
  divide_100: (v) => Number(v) / 100,
  uppercase: (v) => String(v).toUpperCase(),
  lowercase: (v) => String(v).toLowerCase(),
  first_value: (v) => Object.values(v || {})[0],
};

const ymd = (d) =>
  d.getFullYear() +
  "/" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "/" +
  String(d.getDate()).padStart(2, "0");

const COMPUTED = {
  uuid: () => crypto.randomUUID(),
  today_ymd: () => ymd(new Date()),
  today_locale: () => new Date().toLocaleDateString(),
  now_iso: () => new Date().toISOString(),
  now_plus_30min: () => thirty_mins(),
};

const CHECK_OPS = {
  equals: (a, b) => a === b,
  not_equals: (a, b) => a !== b,
  exists: (a, b) =>
    b === false ? a === undefined || a === null : a !== undefined && a !== null,
  in: (a, b) => Array.isArray(b) && b.includes(a),
};

const coerce = (value, type) => {
  if (value === undefined || value === null) return value;
  if (type === "number") return Number(value);
  if (type === "boolean")
    return typeof value === "boolean" ? value : value === "true";
  if (type === "string") return String(value);
  return value;
};

const apply_transforms = (value, transform) => {
  if (!transform) return value;
  const names = Array.isArray(transform) ? transform : [transform];
  return names.reduce((v, name) => {
    const fn = TRANSFORMS[name];
    if (!fn)
      throw new Error(`Unknown transform '${name}' — add it to TRANSFORMS`);
    return fn(v);
  }, value);
};

// Resolves a secret value: `secrets_cache` first (this is config.secrets —
// pre-fetched + decrypted from the db by store.js), then process.env as a
// fallback for anything not yet migrated into the db. Kept synchronous on
// purpose: the whole leaf-resolution pass (resolve_leaf/build_node/
// build_from_map) is synchronous, and secrets arrive already resolved
// rather than needing an await here.
const secret = (ref, staging_ref, staging, secrets_cache) => {
  const key = staging && staging_ref ? staging_ref : ref;
  if (secrets_cache && secrets_cache[key] !== undefined)
    return secrets_cache[key];
  return process.env[key];
};

// ctx = { input, computed, request?, staging, secrets? }
const resolve_leaf = (node, ctx, path_for_errors) => {
  if (Object.prototype.hasOwnProperty.call(node, "const")) return node.const;

  let value;

  if (node.dynamic_key) {
    const parent = get(ctx.input, node.dynamic_key.parent);
    const key = get(ctx.request, node.dynamic_key.key_from);
    value = parent?.[key];
  } else if (node.source === "secret") {
    value = secret(
      node.secret_ref,
      node.staging_secret_ref,
      ctx.staging,
      ctx.secrets,
    );
  } else if (node.join) {
    const source_obj = node.source === "computed" ? ctx.computed : ctx.input;
    value = node.join.fields
      .map((f) => get(source_obj, f))
      .join(node.join.separator ?? "");
  } else {
    const source_obj = node.source === "computed" ? ctx.computed : ctx.input;
    value = node.from !== undefined ? get(source_obj, node.from) : undefined;
    if (
      (value === undefined || value === null) &&
      node.fallback !== undefined
    ) {
      value = get(source_obj, node.fallback);
    }
  }

  if ((value === undefined || value === null) && node.default_computed) {
    value =
      typeof COMPUTED[node.default_computed] === "function"
        ? COMPUTED[node.default_computed]()
        : undefined;
  }
  if ((value === undefined || value === null) && node.default !== undefined) {
    value = node.default;
  }

  if (node.split && typeof value === "string")
    value = value.split(node.split)[node.index ?? 0];

  value = apply_transforms(value, node.transform);
  if (node.type) value = coerce(value, node.type);
  if (node.prefix && value !== undefined && value !== null)
    value = `${node.prefix}${value}`;

  if (
    node.required &&
    (value === undefined || value === null || value === "")
  ) {
    throw new Error(`Required field '${path_for_errors}' resolved to empty`);
  }

  return value;
};

// dispatches a single node of ANY kind (leaf / object / array)
const build_node = (node, ctx, path = "") => {
  if (node.type === "object" && node.schema) {
    return build_from_map(node.schema, ctx, path);
  }
  if (node.type === "array") {
    if (node.single_item) {
      return [build_node(node.items, ctx, path)];
    }
    const list = get(ctx.input, node.from) || [];
    return list.map((el, i) =>
      build_node(node.items, { ...ctx, input: el }, `${path}[${i}]`),
    );
  }
  return resolve_leaf(node, ctx, path);
};

const build_from_map = (map, ctx, path = "") => {
  const out = {};
  for (const key of Object.keys(map)) {
    out[key] = build_node(map[key], ctx, path ? `${path}.${key}` : key);
  }
  return out;
};

// `request` is the ORIGINAL input payload (before the courier response came
// back) — needed for dynamic_key leaves like Fez's `orderNos[<reference>]`,
// which look up the response using a key that lives in the request.
const extract_from_map = (map, response, request) =>
  build_from_map(map, { input: response, computed: {}, request });

const run_check = (check, response) => {
  if (!check) return true;
  const checks = Array.isArray(check) ? check : [check];
  return checks.every((c) => {
    const value = get(response, c.from);
    for (const op of Object.keys(CHECK_OPS)) {
      if (Object.prototype.hasOwnProperty.call(c, op))
        return CHECK_OPS[op](value, c[op]);
    }
    return true;
  });
};

const resolve_url = (config, endpoint, staging) => {
  const base =
    staging && config.staging_base_url
      ? config.staging_base_url
      : config.base_url;
  return `${base}${endpoint.path}`;
};

const read_response = async (res, response_type) => {
  if (response_type === "text-prefixed-json") {
    const text = await res.text();
    const start = text.indexOf("{");
    if (start === -1) throw new Error("No JSON found in response body");
    return JSON.parse(text.slice(start));
  }
  return res.json();
};

// ---------- auth: optional login call, then a flat header map ----------
// Returns BOTH the resolved headers (for the outgoing fetch call) and the
// raw `computed_auth` object (for couriers like Kwik whose login result
// needs to be read into the request BODY, not a header).
const resolve_auth = async (config, staging) => {
  const auth = config.auth;
  if (!auth) return { headers: {}, computed: {} };

  const secrets = config.secrets;

  let computed_auth = {};

  if (auth.login) {
    const body = build_from_map(auth.login.body_map || {}, {
      input: {},
      computed: COMPUTED,
      staging,
      secrets,
    });
    const res = await fetch(resolve_url(config, auth.login, staging), {
      method: auth.login.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    debug(data, `${config.name} auth response`);
    computed_auth = extract_from_map(auth.login.extract || {}, data);
  }

  const ctx = {
    input: {},
    computed: { ...COMPUTED, auth: computed_auth },
    staging,
    secrets,
  };
  const headers = auth.headers ? build_from_map(auth.headers, ctx) : {};
  return { headers, computed: computed_auth };
};

// ============================================================
const build_body = (endpoint, ctx) =>
  endpoint.body_root
    ? build_node(endpoint.body_root, ctx)
    : build_from_map(endpoint.body_map || {}, ctx);

const runEstimate = async (
  config,
  payload,
  { staging = !!process.env.STAGING } = {},
) => {
  const endpoint = config.estimate;

  try {
    const { headers: auth_headers, computed: computed_auth } =
      await resolve_auth(config, staging);
    const ctx = {
      input: payload,
      computed: { ...COMPUTED, auth: computed_auth },
      staging,
      secrets: config.secrets,
    };
    const body = build_body(endpoint, ctx);
    debug(body, `${config.name} estimate request`);

    const res = await fetch(resolve_url(config, endpoint, staging), {
      method: endpoint.method || "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...auth_headers,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    debug(data, `${config.name} estimate response`);

    if (!run_check(endpoint.success_check, data)) return null;
    return {
      courier: config.name,
      ...extract_from_map(endpoint.extract, data, payload),
    };
  } catch (e) {
    debug(e, `${config.name} estimate error`);
    return null;
  }
};

const runCreate = async (
  config,
  details,
  { staging = !!process.env.STAGING } = {},
) => {
  const endpoint = config.create;
  let reply = {};

  // Some couriers echo a client-generated reference back inside the response
  // under a dynamic key (Fez: `orderNos[<reference>]`). Resolve it up front
  // so the same value is used in the outgoing body AND the extraction step.
  if (endpoint.ensure_reference_field) {
    details[endpoint.ensure_reference_field] =
      details[endpoint.ensure_reference_field] || crypto.randomUUID();
  }

  try {
    // Same login-then-build-body flow as runEstimate: resolve auth FIRST so
    // any login result (a header, or values like Kwik's access_token/vendor_id
    // that get read into the body via `source: "computed", from: "auth.x"`)
    // is available while the body is being built.
    const { headers: auth_headers, computed: computed_auth } =
      await resolve_auth(config, staging);
    const ctx = {
      input: details,
      computed: { ...COMPUTED, auth: computed_auth },
      staging,
      secrets: config.secrets,
    };
    const body = build_body(endpoint, ctx);
    debug(body, `${config.name} create request`);

    const res = await fetch(resolve_url(config, endpoint, staging), {
      method: endpoint.method || "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...auth_headers,
      },
      body: JSON.stringify(body),
    });

    const data = await read_response(res, endpoint.response_type);
    debug(data, `${config.name} create response`);

    if (!run_check(endpoint.success_check, data)) {
      reply.message = endpoint.error_message
        ? resolve_leaf(
            endpoint.error_message,
            { input: data, computed: {}, request: details },
            "error_message",
          )
        : `${config.name} order failed`;
      return reply;
    }

    reply = { ...reply, ...extract_from_map(endpoint.extract, data, details) };
  } catch (e) {
    console.error(`${config.name} create error:`, e);
    reply.message = e.message;
  }

  return reply;
};

const verify_webhook = (config, req, staging) => {
  const v = config.webhook?.verify;
  if (!v || v.type === "none") return true;

  const token = secret(
    v.secret_ref,
    v.staging_secret_ref,
    staging,
    config.secrets,
  );
  const received =
    req.headers[v.header] || req.headers[v.header?.toLowerCase()];

  if (v.type === "hmac") {
    const hash = crypto
      .createHmac(v.algorithm, token)
      .update(JSON.stringify(req.body))
      .digest("hex");
    return hash === received;
  }

  if (v.type === "hmac_concat") {
    // concat_fields are resolved against body+headers merged, so a field
    // like Fez's timestamp (which arrives in a header, not the body) can be
    // referenced as "headers.x-timestamp".
    const source = { ...req.body, headers: req.headers };
    const signing_string = v.concat_fields.map((f) => get(source, f)).join("");
    const hash = crypto
      .createHmac(v.algorithm, token)
      .update(signing_string)
      .digest("hex");
    return hash === received;
  }

  if (v.type === "hmac_timestamped_header") {
    // Stripe-style header: "t=<timestamp>,v1=<signature>" (keys/separators
    // are configurable). The signed string is `${timestamp}.${JSON.stringify(req.body)}`.
    if (!received) return !!v.optional; // fail closed unless the courier explicitly opts into leniency

    const part_sep = v.part_separator ?? ",";
    const kv_sep = v.kv_separator ?? "=";
    const parts = {};
    for (const chunk of String(received).split(part_sep)) {
      const idx = chunk.indexOf(kv_sep);
      if (idx === -1) continue;
      parts[chunk.slice(0, idx)] = chunk.slice(idx + kv_sep.length);
    }

    const timestamp = parts[v.timestamp_key ?? "t"];
    const signature = parts[v.signature_key ?? "v1"];
    if (!timestamp || !signature) return false;

    if (v.max_skew_seconds != null) {
      const ts = Number(timestamp);
      if (
        !Number.isFinite(ts) ||
        Math.abs(Math.floor(Date.now() / 1000) - ts) > v.max_skew_seconds
      ) {
        return false;
      }
    }

    const signing_string = `${timestamp}.${JSON.stringify(req.body)}`;
    const expected = crypto
      .createHmac(v.algorithm, token)
      .update(signing_string)
      .digest("hex");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  return false; // unknown type — fail closed
};

const check_replay = (config, event) => {
  const rp = config.webhook?.replay_protection;
  if (!rp) return true;
  const ts = Number(get(event, rp.timestamp_field));
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - ts) <= rp.max_skew_seconds;
};

const runWebhook = async (config, req, { staging = false } = {}) => {
  const wh = config.webhook;
  if (!wh) return false; // courier has no webhook wired up yet

  // Merge headers into one object so tracking_id/status_value/gate/hmac_concat
  // leaves can pull from either the JSON body or an HTTP header.
  const event = { ...req.body, headers: req.headers };

  if (wh.gate && !run_check(wh.gate, event)) return false;
  if (!verify_webhook(config, req, staging)) return false;
  if (!check_replay(config, event)) return false;

  const tracking_id = resolve_leaf(
    wh.tracking_id,
    { input: event, computed: {} },
    "webhook.tracking_id",
  );
  if (!tracking_id) return false;

  const status_raw = resolve_leaf(
    wh.status_value,
    { input: event, computed: {} },
    "webhook.status_value",
  );
  if (!status_raw) return false;

  const ongoing_status = wh.status_map?.[String(status_raw).toUpperCase()];
  if (!ongoing_status) return false;

  return await Orders_update(String(tracking_id), ongoing_status, {
    db: req.db,
  });
};

export {
  runEstimate,
  runCreate,
  runWebhook,
  get,
  build_from_map,
  build_node,
  extract_from_map,
};
