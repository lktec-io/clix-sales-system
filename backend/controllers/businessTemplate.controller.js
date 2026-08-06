import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as businessTemplateService from '../services/businessTemplate.service.js';

export const list = asyncHandler(async (req, res) => {
  const data = await businessTemplateService.listForAdmin();
  return success(res, { data });
});

export const getDetail = asyncHandler(async (req, res) => {
  const data = await businessTemplateService.getDetail(Number(req.params.id));
  return success(res, { data });
});

export const create = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.createTemplate(req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Template created', data: template, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.updateTemplate(Number(req.params.id), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Template updated', data: template });
});

export const duplicate = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.duplicateTemplate(Number(req.params.id), req.body, req.platformAdmin, req.ip);
  return success(res, { message: 'Template duplicated', data: template, status: 201 });
});

export const activate = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.activateTemplate(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Template activated', data: template });
});

export const deactivate = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.deactivateTemplate(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Template deactivated', data: template });
});

export const archive = asyncHandler(async (req, res) => {
  const template = await businessTemplateService.archiveTemplate(Number(req.params.id), req.platformAdmin, req.ip);
  return success(res, { message: 'Template archived', data: template });
});

export const setModules = asyncHandler(async (req, res) => {
  const data = await businessTemplateService.setModules(Number(req.params.id), req.body.modules, req.platformAdmin, req.ip);
  return success(res, { message: 'Template modules updated', data });
});

export const setDefaultSetting = asyncHandler(async (req, res) => {
  const data = await businessTemplateService.setDefaultSetting(
    Number(req.params.id), req.body.key, req.body.value, req.body.dataType, req.platformAdmin, req.ip,
  );
  return success(res, { message: 'Default setting saved', data });
});
