import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; 

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      return cb(ApiError.badRequest('Only .csv files are accepted'));
    }
    cb(null, true);
  },
});

export default upload;
