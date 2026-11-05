import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; 

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest('Only PNG, JPEG, or WEBP images are accepted'));
    }
    cb(null, true);
  },
});

export default uploadImage;
