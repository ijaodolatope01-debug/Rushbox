// libs/v3/crypto.js
//
// Thin wrappers around gp.utils.cypher so the rest of the codebase never
// has to know about RUSHBOX_SECRET or the cypher API shape.
//
// Actual shape (from utils):
//   gp.utils.cypher.encrypt(payload, secret) → base64 string (iv:tag:data)
//   gp.utils.cypher.decrypt(enc, secret)     → parsed value (or null on failure)
//
// Note: encryptToken JSON.stringifies the payload and decryptToken JSON.parses
// the result. We therefore pass/return plain strings and let the cypher
// layer handle the JSON round-trip.

const SECRET = process.env.RUSHBOX_SECRET;

if (!SECRET) {
  throw new Error("RUSHBOX_SECRET is not set");
}

const getCypher = () => {
  const cypher = global.gp?.utils?.cypher;
  if (!cypher?.encrypt || !cypher?.decrypt) {
    throw new Error(
      "gp.utils.cypher is not available yet (app not booted, or cypher not attached)",
    );
  }
  return cypher;
};

/**
 * Encrypt a plaintext secret value.
 * @param {string} value
 * @returns {string} ciphertext (iv:tag:data)
 */
export const encrypt_secret = (value) => {
  if (typeof value !== "string") {
    throw new TypeError("encrypt_secret expects a string");
  }
  return getCypher().encrypt(value, SECRET);
};

/**
 * Decrypt a previously encrypted secret value.
 * @param {string} ciphertext
 * @returns {string|null} plaintext, or null if decryption fails
 */
export const decrypt_secret = (ciphertext) => {
  if (typeof ciphertext !== "string") {
    throw new TypeError("decrypt_secret expects a string");
  }
  const result = getCypher().decrypt(ciphertext, SECRET);
  // decryptToken returns null on failure; also guard against non-string
  // results in case a non-string was originally encrypted.
  if (result === null || result === undefined) return null;
  return typeof result === "string" ? result : String(result);
};
