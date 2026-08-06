import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import * as qrCodeController from '../controllers/qrCode.controller.js';
import * as labelController from '../controllers/label.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireModule } from '../middlewares/requireModule.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { createUploader } from '../middlewares/upload.js';
import { productValidator, bulkStatusValidator } from '../validators/product.validator.js';
import { bulkLabelValidator } from '../validators/label.validator.js';

const router = Router();
const productImageUploader = createUploader({ subfolder: 'products', maxSizeMb: 3 });

router.use(authenticate);

// Reads are deliberately ungated by requireModule — Sales' POS checkout
// (sellable/lookup) and Inventory's product listings depend on this data
// regardless of whether the Products management module itself is enabled
// for this tenant, same reasoning branches/customers/suppliers' lightweight
// lookup routes are exempt.
router.get('/', authorize('products.view'), productController.list);
router.get('/sellable', authorize('products.view'), productController.sellable);
// Placed before /:id so "lookup" is never captured as an :id value.
router.get('/lookup', authorize('products.view'), productController.lookupSellable);
router.get('/:id', authorize('products.view'), productController.getById);
router.get('/:id/qr', authorize('products.view'), qrCodeController.getForProduct);

router.use(requireModule('products'));

// Only Super Administrator holds products.delete in the seeded RBAC (see
// 001_seed_roles_permissions.sql) — reused here rather than a new
// permission code, since "who may permanently remove a product" is exactly
// the same authority as "who may delete one" in the first place. Placed
// before the /:id routes so "archived" is never captured as an :id value.
router.get('/archived', authorize('products.delete'), productController.listArchived);
router.post('/', authorize('products.create'), productValidator, validateRequest, productController.create);
router.put('/:id', authorize('products.edit'), productValidator, validateRequest, productController.update);
router.patch('/bulk-status', authorize('products.manage'), bulkStatusValidator, validateRequest, productController.bulkStatus);
router.delete('/:id', authorize('products.delete'), productController.remove);
router.post('/:id/restore', authorize('products.delete'), productController.restore);
router.delete('/:id/permanent', authorize('products.delete'), productController.permanentDelete);
router.post('/:id/images', authorize('products.edit'), productImageUploader.single('image'), productController.uploadImage);
router.delete('/:id/images/:imageId', authorize('products.edit'), productController.removeImage);
router.post('/:id/qr/regenerate', authorize('products.manage'), qrCodeController.regenerate);
router.post('/labels', authorize('products.print'), bulkLabelValidator, validateRequest, labelController.bulk);
router.get('/:id/label', authorize('products.print'), labelController.single);

export default router;
