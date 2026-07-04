import crypto from "crypto";

const hash = (data, alg) => {
  alg = (alg || "sha256").replace(/-/g, "").toLowerCase();
  let hash = crypto.createHash(alg);

  hash.update(data);

  let result = hash.digest("hex");

  if (alg) {
    if (!isNaN(Number(result[0]))) result = `_${result.slice(0, -1)}`;
  }

  return result;
};

export { hash };
