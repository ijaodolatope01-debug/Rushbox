import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccount = JSON.parse(
  fs.readFileSync(
    path.resolve("./utils/firebase-service-account.json"),
    "utf8",
  ),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
