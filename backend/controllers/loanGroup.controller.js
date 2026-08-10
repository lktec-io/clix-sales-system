import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as loanGroupService from '../services/loanGroup.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await loanGroupService.listGroups(req.query, req.user.tenantId);
  return success(res, { data: { items, meta } });
});

export const getById = asyncHandler(async (req, res) => {
  const group = await loanGroupService.getGroup(Number(req.params.id), req.user.tenantId);
  return success(res, { data: group });
});

export const create = asyncHandler(async (req, res) => {
  const group = await loanGroupService.createGroup(req.body, req.user.id, req.user.tenantId);
  return success(res, { message: 'Group created', data: group, status: 201 });
});

export const update = asyncHandler(async (req, res) => {
  const group = await loanGroupService.updateGroup(Number(req.params.id), req.body, req.user.tenantId);
  return success(res, { message: 'Group updated', data: group });
});

export const addMember = asyncHandler(async (req, res) => {
  const members = await loanGroupService.addMember(Number(req.params.id), Number(req.body.customerId), req.user.tenantId);
  return success(res, { message: 'Member added', data: members, status: 201 });
});

export const removeMember = asyncHandler(async (req, res) => {
  const members = await loanGroupService.removeMember(Number(req.params.id), Number(req.params.customerId), req.user.tenantId);
  return success(res, { message: 'Member removed', data: members });
});
