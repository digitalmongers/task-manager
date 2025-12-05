import multer from "multer";

const storage = multer.memoryStorage(); // No disk, no heavy load

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit  
});

export default upload;
