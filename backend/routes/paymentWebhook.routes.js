import { Router } from 'express';
import * as paymentWebhookController from '../controllers/paymentWebhook.controller.js';
import { verifyWebhookSignature } from '../middlewares/verifyWebhookSignature.js';

// Deliberately NOT mounted under /api/v1 alongside the tenant router tree,
// and NOT behind authenticate()/authenticatePlatform() — a payment
// provider has no tenant or platform-admin JWT to send. Trust instead
// comes entirely from verifyWebhookSignature, mounted first on every
// route below, which fails closed (Step 5/15). :provider lets each
// registered provider (paymentProviders/index.js) receive its own webhook
// path without a new router file per provider.
const router = Router();

router.post('/:provider', verifyWebhookSignature, paymentWebhookController.handleWebhook);

export default router;
