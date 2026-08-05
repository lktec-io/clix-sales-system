import { body } from 'express-validator';

export const updatePlatformSettingsValidator = [
  body('companyBrandingName').optional({ values: 'falsy' }).trim().isLength({ max: 150 }),
  body('supportEmail').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid support email'),
  body('supportPhone').optional({ values: 'falsy' }).isLength({ max: 20 }),
  body('trialDurationDefaultDays').optional().isInt({ min: 1, max: 365 }).withMessage('Trial duration must be between 1 and 365 days'),
  body('maintenanceMode').optional().isBoolean().withMessage('maintenanceMode must be a boolean'),
  body('platformAnnouncement').optional({ values: 'falsy' }).isLength({ max: 1000 }),
];
