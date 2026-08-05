import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { requireActiveTrial } from '../middlewares/requireActiveTrial.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { expenseValidator } from '../validators/expense.validator.js';

const router = Router();

router.use(authenticate, authorize('expenses.view'));

router.get('/categories', expenseController.listCategories);
router.get('/', expenseController.list);
router.get('/:id', expenseController.getById);
router.post('/', authorize('expenses.create'), requireActiveTrial, expenseValidator, validateRequest, expenseController.create);
router.put('/:id', authorize('expenses.edit'), requireActiveTrial, expenseValidator, validateRequest, expenseController.update);
router.delete('/:id', authorize('expenses.delete'), requireActiveTrial, expenseController.remove);

export default router;
