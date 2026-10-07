/** Prints real detail-route URLs so the screenshot sweep can cover them. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "nexastore" });
const db = mongoose.connection.db;
const [sale, product, customer] = await Promise.all([
  db.collection("sales").findOne({ status: "completed" }),
  db.collection("products").findOne({}),
  db.collection("customers").findOne({ totalOrders: { $gt: 2 } }),
]);
console.log([
  `/sales/${sale._id}`,
  `/invoices/${sale._id}`,
  `/products/${product._id}`,
  `/products/${product._id}/edit`,
  `/customers/${customer._id}`,
  "/products/new",
  "/settings/profile",
  "/settings/appearance",
].join(" "));
await mongoose.disconnect();
