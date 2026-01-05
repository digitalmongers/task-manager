import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for Enterprise safety
  fileFilter: (req, file, cb) => {
    // Whitelist for common enterprise attachment types
    const allowedTypes = [
      'image/', 'audio/', 'application/pdf', 
      'application/zip', 'application/x-zip-compressed',
      'application/vnd.rar', 'application/x-rar-compressed',
      'text/plain', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
    
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed for security reasons.`), false);
    }
  }
});

export default upload;
