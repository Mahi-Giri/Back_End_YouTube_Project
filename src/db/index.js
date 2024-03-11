import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
    try {
        const connectionResponce = await mongoose.connect(
            `${process.env.MONGO_URL}/${DB_NAME}`
        );
        console.log(
            `Connected to the Host ${connectionResponce.connection.host}`
        );
    } catch (error) {
        console.error("MongoDB connection faild: " + error);
        process.exit(1);
    }
};

export default connectDB;
