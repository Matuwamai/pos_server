import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import productImportExportService from '../services/productImportExport.js';

const importCsv = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('A CSV file is required (multipart field name: "file")');
  }
  const result = await productImportExportService.importProductsFromCsv(req.file.buffer);
  res.status(200).json(result);
});

const exportCsv = asyncHandler(async (req, res) => {
  const csv = await productImportExportService.exportProductsToCsv();
  res
    .status(200)
    .set('Content-Type', 'text/csv')
    .set('Content-Disposition', 'attachment; filename="products.csv"')
    .send(csv);
});

export default { importCsv, exportCsv };
