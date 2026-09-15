import asyncHandler from '../utils/asyncHandler.js';
import invoiceService from '../services/invoice.js';
import invoiceDocumentService from '../services/invoiceDocument.js';

const create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice(req.user, req.body);
  res.status(201).json(invoice);
});

const list = asyncHandler(async (req, res) => {
  const result = await invoiceService.listInvoices(req.validatedQuery);
  res.status(200).json(result);
});

const getById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  res.status(200).json(invoice);
});

const getDocument = asyncHandler(async (req, res) => {
  const html = await invoiceDocumentService.generateInvoiceHtml(req.params.id);
  res.status(200).type('html').send(html);
});

const update = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  res.status(200).json(invoice);
});

const issue = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.issueInvoice(req.params.id);
  res.status(200).json(invoice);
});

const recordPayment = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.recordPayment(req.user, req.params.id, req.body);
  res.status(201).json(invoice);
});

const voidInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.voidInvoice(req.params.id, req.body.reason);
  res.status(200).json(invoice);
});

export default { create, list, getById, getDocument, update, issue, recordPayment, void: voidInvoice };
