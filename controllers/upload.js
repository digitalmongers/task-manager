import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

export const uploadToCloudinary = (file, folder = "dobbyMall") => {
  return new Promise((resolve, reject) => {
    // Handle both Multer file and custom buffer/mimetype objects
    const mimetype = file.mimetype || '';
    let resourceType = mimetype.startsWith("video/") ? "video" : "image";
    if (mimetype.startsWith("audio/")) resourceType = "raw"; // Cloudinary uses raw/auto for audio

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto", // Let cloudinary handle the specific type
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    const buffer = file.buffer;
    if (!buffer) return reject(new Error('No file buffer provided'));
    
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const uploadSingle = async (req, res) => {
  if (!req.file) throw ApiError.badRequest("File is required");

  const result = await uploadToCloudinary(req.file);

  ApiResponse.success(res, 200, "File uploaded successfully", {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    resourceType: result.resource_type,
    bytes: result.bytes,
  });
};

export const uploadMultiple = async (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest("No files uploaded");

  const uploaded = await Promise.all(
    req.files.map(file => uploadToCloudinary(file))
  );

  ApiResponse.success(res, 200, "Files uploaded successfully", {
    files: uploaded.map(f => ({
      url: f.secure_url,
      publicId: f.public_id,
      format: f.format,
      resourceType: f.resource_type,
      bytes: f.bytes,
    })),
    count: uploaded.length,
  });
};


export const uploadFields = async (req, res) => {
  const response = {
    avatar: req.files?.avatar?.[0] 
      ? await uploadToCloudinary(req.files.avatar[0])
      : null,
    gallery: req.files?.gallery 
      ? await Promise.all(req.files.gallery.map(f => uploadToCloudinary(f)))
      : [],
  };

  const formatted = {
    avatar: response.avatar ? {
      url: response.avatar.secure_url,
      publicId: response.avatar.public_id,
    } : null,
    gallery: response.gallery.map(f => ({
      url: f.secure_url,
      publicId: f.public_id,
    })),
  };

  ApiResponse.success(res, 200, 'Files uploaded successfully', formatted);
};
