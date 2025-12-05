import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = "image"; 

    if (file.mimetype.startsWith("video/")) {
      resourceType = "video";
    }
 
    return {
      folder: "dobbyMall",
      resource_type: resourceType,
      allowed_formats: ["jpg", "png", "jpeg", "gif", "ico", "svg", "webp", "mp4", "wmv", "mkv", "avi"],
    };
  },
});

const upload = multer({ storage });

export default upload;
