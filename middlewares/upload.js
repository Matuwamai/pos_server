import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // a product spreadsheet has no business being bigger than this

// Memory storage: files are small, one-shot, and never need to touch disk —
// the buffer is parsed and discarded within a single request.
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
