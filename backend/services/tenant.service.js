import crypto from 'crypto';
import { pool } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { slugify } from '../utils/slug.js';
import { issueTokensForUser, hashPassword } from './auth.service.js';
import { sendMail, welcomeEmail } from './email.service.js';
import * as tenantRepository from '../repositories/tenant.repository.js';
import * as branchRepository from '../repositories/branch.repository.js';
import * as userRepository from '../repositories/user.repository.js';
import * as companyRepository from '../repositories/company.repository.js';
import * as roleRepository from '../repositories/role.repository.js';
import * as permissionRepository from '../repositories/permission.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

const TRIAL_DAYS = 14;
const MAX_COMPANY_CODE_ATTEMPTS = 5;

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safe } = user;
  return safe;
}

// Same shape login()/refresh() already hand back — permissions read fresh
// from the role, never trusted from a stale claim (see auth.service.js's
// comment on why authorize() re-checks this itself regardless).
async function withPermissions(user) {
  const permissions = await permissionRepository.getCodesForRole(user.role_id);
  return { ...sanitizeUser(user), permissions };
}

export async function register({
  companyName, ownerFirstName, ownerLastName, businessEmail, phone, password,
  businessType, country, ipAddress, userAgent,
}) {
  if (!isStrongPassword(password)) {
    throw new ApiError(400, PASSWORD_POLICY_MESSAGE);
  }

  // Registration-only global email check — closes the login-ambiguity gap
  // findByEmailOrUsername()'s own comment flags (see user.repository.js).
  const existingEmail = await userRepository.findByEmailGlobal(businessEmail);
  if (existingEmail) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const superAdminRole = await roleRepository.findByName('Super Administrator');
  if (!superAdminRole) {
    throw new ApiError(500, 'Server is not set up correctly (Super Administrator role missing). Contact support.');
  }

  const passwordHash = await hashPassword(password);
  const baseCode = slugify(companyName);
  const baseUsername = slugify(businessEmail.split('@')[0]);
  const trialStartedAt = new Date();
  const trialEndsAt = addDays(trialStartedAt, TRIAL_DAYS);

  let tenant;
  let user;
  let branch;

  for (let attempt = 0; attempt < MAX_COMPANY_CODE_ATTEMPTS; attempt += 1) {
    const candidateCode = attempt === 0 ? baseCode : `${baseCode}-${crypto.randomBytes(2).toString('hex')}`;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      tenant = await tenantRepository.create({
        companyName,
        companyCode: candidateCode,
        subscriptionStatus: 'trial',
        trialStartedAt,
        trialEndsAt,
      }, connection);

      // A brand-new tenant has zero branches, but almost every business
      // action (sales, inventory, purchases) requires one — created before
      // the user below so it can never be left dangling if user creation
      // fails. No prior actor exists yet, so created_by/updated_by are NULL
      // (both nullable — see 002_create_branches_users.sql).
      branch = await branchRepository.create({
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'MAIN',
        status: 'active',
        userId: null,
      }, connection);

      // Tenant's very first user — no other user can exist yet within this
      // tenant, so the (tenant_id, username) composite key can't collide;
      // no uniqueness retry needed here the way admin-created users need one.
      user = await userRepository.create({
        tenantId: tenant.id,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        phone,
        email: businessEmail,
        username: baseUsername,
        passwordHash,
        roleId: superAdminRole.id,
        branchId: branch.id,
        status: 'active',
      }, connection);

      await companyRepository.insert({
        tenantId: tenant.id,
        companyName,
        businessType: businessType || null,
        phone,
        email: businessEmail,
        country: country || null,
        currency: 'TZS',
        timezone: 'Africa/Dar_es_Salaam',
        status: 'active',
        userId: user.id,
      }, connection);

      await connection.commit();
      break;
    } catch (err) {
      await connection.rollback();
      if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage?.includes('company_code')) {
        if (attempt === MAX_COMPANY_CODE_ATTEMPTS - 1) {
          throw new ApiError(500, 'Could not generate a unique company code. Please try again.');
        }
        continue; // retry with a random suffix
      }
      throw err;
    } finally {
      connection.release();
    }
  }

  const userWithPermissions = await withPermissions(user);
  const tokens = await issueTokensForUser(user, { rememberMe: false, ipAddress, userAgent }, userWithPermissions.permissions);

  // Best-effort only — never lets a delivery hiccup fail the registration
  // response (sendMail() itself already never throws, see email.service.js).
  const { subject, html } = welcomeEmail(companyName, ownerFirstName);
  sendMail({ to: businessEmail, subject, html, template: 'welcome' });

  await activityLogRepository.create({
    tenantId: tenant.id,
    userId: user.id,
    branchId: branch.id,
    description: `${ownerFirstName} ${ownerLastName} registered "${companyName}"`,
    referenceType: 'tenant.register',
    referenceId: tenant.id,
  });

  return { ...tokens, user: userWithPermissions };
}

export async function getMyTenant(tenant) {
  return {
    companyName: tenant.company_name,
    companyCode: tenant.company_code,
    status: tenant.status,
    subscriptionStatus: tenant.subscription_status,
    trialStartedAt: tenant.trial_started_at,
    trialEndsAt: tenant.trial_ends_at,
  };
}
