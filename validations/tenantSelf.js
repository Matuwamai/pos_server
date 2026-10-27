import { z } from 'zod';

// Digits only — a Till (Buy Goods) number is typically 5-7 digits, a Paybill
// shortcode 5-7 as well; capped generously since Safaricom hasn't published
// a hard limit and this is purely descriptive (not validated against Daraja
// in v1, since no API credentials are involved yet).
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

export default { updatePayments };
