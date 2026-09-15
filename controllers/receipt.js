import asyncHandler from '../utils/asyncHandler.js';
import receiptService from '../services/receipt.js';

const getReceipt = asyncHandler(async (req, res) => {
  const html = await receiptService.generateReceiptHtml(req.params.id);
  res.status(200).type('html').send(html);
});

export default { getReceipt };
