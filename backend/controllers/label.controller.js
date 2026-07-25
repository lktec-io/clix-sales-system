import { asyncHandler } from '../utils/asyncHandler.js';
import * as labelService from '../services/label.service.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as companyService from '../services/company.service.js';

async function resolveBranchName(branchId) {
  if (!branchId) return null;
  const branch = await branchRepository.findById(Number(branchId));
  return branch?.name || null;
}

export const single = asyncHandler(async (req, res) => {
  const branchName = await resolveBranchName(req.query.branchId);
  const company = await companyService.getProfile();
  const pdf = await labelService.buildLabelsPdf([Number(req.params.id)], branchName, req.query.size, company);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="label.pdf"');
  res.send(pdf);
});

export const bulk = asyncHandler(async (req, res) => {
  const branchName = await resolveBranchName(req.body.branchId);
  const company = await companyService.getProfile();
  const pdf = await labelService.buildLabelsPdf(req.body.productIds, branchName, req.body.size, company);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="labels.pdf"');
  res.send(pdf);
});
