import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnClodinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // Upload file on Clodinary

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        // File has been upload successfully
        console.log("File is uploaded successfully", response.url);

        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);
        // remove locally uploaded file
        return null;
    }
};

export { uploadOnClodinary };
