import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Atomic per-store sequences. findOneAndUpdate with $inc is a single-document
 * operation, so two tills ringing up at the same instant can never be handed
 * the same order number - which a "count the collection + 1" approach would do.
 */
export interface CounterDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  key: string;
  value: number;
}

const CounterSchema = new Schema<CounterDoc>({
  storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
  key: { type: String, required: true },
  value: { type: Number, default: 0 },
});

CounterSchema.index({ storeId: 1, key: 1 }, { unique: true });

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) || model<CounterDoc>("Counter", CounterSchema);
