import { Schema, model, models, type Model, type Types } from "mongoose";
import { baseSchemaOptions, tenantFields } from "./shared";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type ExpenseCategory, type PaymentMethod } from "./enums";

/**
 * Operating expenses. These sit BELOW gross profit in the P&L - the cost of
 * goods sold lives on SaleItem.cogsAmount and is never entered here, which is
 * what stops inventory purchases being counted twice.
 */
export interface ExpenseDoc {
  _id: Types.ObjectId;
  storeId: Types.ObjectId;
  category: ExpenseCategory;
  /** Integer minor units. */
  amount: number;
  description: string;
  vendor?: string;
  /** The date the expense is recognised against. */
  date: Date;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  recurring: boolean;
  recurrenceInterval?: "weekly" | "monthly" | "quarterly" | "yearly";
  createdBy: string;
  createdByName?: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDoc>(
  {
    ...tenantFields,
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    vendor: { type: String, trim: true, maxlength: 120 },
    date: { type: Date, required: true, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    receiptUrl: String,
    notes: { type: String, maxlength: 2000 },
    recurring: { type: Boolean, default: false },
    recurrenceInterval: { type: String, enum: ["weekly", "monthly", "quarterly", "yearly"] },
    createdBy: { type: String, required: true },
    createdByName: String,
  },
  baseSchemaOptions,
);

ExpenseSchema.index({ storeId: 1, date: -1 });
ExpenseSchema.index({ storeId: 1, category: 1, date: -1 });
ExpenseSchema.index({ description: "text", vendor: "text", notes: "text" }, { name: "expense_text" });

export const Expense: Model<ExpenseDoc> =
  (models.Expense as Model<ExpenseDoc>) || model<ExpenseDoc>("Expense", ExpenseSchema);
