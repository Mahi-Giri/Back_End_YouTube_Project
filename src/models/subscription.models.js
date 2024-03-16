import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
    {
        subscriber: {
            type: Schema.Types.ObjectId, // One who are subscribing
            ref: "User",
        },
        channel: {
            type: Schema.Types.ObjectId, // one who are "subscriber" is subscribing
            ref: "User",
        },
    },
    { timestamps: true }
);

export const Subscription = model("Subscription", subscriptionSchema);
