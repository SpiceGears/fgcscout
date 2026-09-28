const databaseName = process.env.MONGO_APP_DATABASE || "fgcscout";
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;

if (!username || !password) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be configured.");
}

const applicationDatabase = db.getSiblingDB(databaseName);
applicationDatabase.createUser({
  user: username,
  pwd: password,
  roles: [{ role: "readWrite", db: databaseName }],
});
