import { z } from 'zod';
const shortcodeRegex = /^[0-9]{4,12}$/;

const updatePayments = {
  body: z
    .object({
      mpesaType: z.enum(['TILL', 'PAYBILL']).nullable(),
      mpesaShortcode: z.string().regex(shortcodeRegex, 'Digits only (4-12 characters)').nullable(),
    })
    .refine((d) => (d.mpesaType === null) === (d.mpesaShortcode === null), {
      message: 'mpesaType and mpesaShortcode must be set together, or both cleared',
    }),
};

const updateMpesaCredential = {
  body: z.object({
    consumerKey: z.string().min(1),
    consumerSecret: z.string().min(1),
    passkey: z.string().min(1),
    environment: z.enum(['SANDBOX', 'PRODUCTION']).default('SANDBOX'),
  }),
};

const updateStripeCredential = {
  body: z.object({
    secretKey: z.string().min(1),
  }),
};

export default { updatePayments, updateMpesaCredential, updateStripeCredential };
