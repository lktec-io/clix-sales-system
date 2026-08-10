import { Router } from 'express';
import * as companyController from '../controllers/company.controller.js';
import { authenticate, authenticateOptional } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { upsertCompanyValidator } from '../validators/company.validator.js';
import { createUploader } from '../middlewares/upload.js';

const router = Router();
const logoUploader = createUploader({ subfolder: 'logo', cloudinaryFolder: 'company', maxSizeMb: 2 });

// The login page (pre-authentication) needs the company name/logo too, so
// this can't be a hard authenticate() gate — but this is a multi-tenant
// system, so an anonymous caller has no tenant to resolve a profile for.
// authenticateOptional() populates req.user/req.tenant when a valid token
// is present (Settings > Company Profile, Navbar, etc.) and leaves them
// unset otherwise; the controller returns that tenant's profile or null.
router.get('/', authenticateOptional, companyController.getCompany);

router.put('/', authenticate, authorize('company.manage'), upsertCompanyValidator, validateRequest, companyController.updateCompany);
router.post('/logo', authenticate, authorize('company.manage'), logoUploader.single('logo'), companyController.uploadLogo);

export default router;
