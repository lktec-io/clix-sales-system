// One-time bootstrap script to create the first Super Administrator.
// Run manually after migrations/seeders: `npm run seed:admin` from backend/.
// Accepts values via env vars (ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_PHONE,
// ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD) for non-interactive use, or
// prompts interactively for anything not supplied. No credentials are
// hardcoded — nothing is created without explicit input at run time.

import readline from 'readline/promises';
import { stdin, stdout } from 'process';
import { pool } from '../../config/db.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../../utils/passwordPolicy.js';
import { hashPassword } from '../../services/auth.service.js';
import * as roleRepository from '../../repositories/role.repository.js';
import * as userRepository from '../../repositories/user.repository.js';

const CTRL_C = '\x03';
const BACKSPACE_CODES = ['\x7f', '\x08'];
const ENTER_CODES = ['\n', '\r'];

const rl = readline.createInterface({ input: stdin, output: stdout });

async function promptVisible(question, envValue) {
  if (envValue) return envValue;
  return rl.question(question);
}

async function promptHidden(question, envValue) {
  if (envValue) return envValue;

  stdout.write(question);
  return new Promise((resolve) => {
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === CTRL_C) {
        process.exit(1);
      }
      if (ENTER_CODES.includes(char)) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (BACKSPACE_CODES.includes(char)) {
        value = value.slice(0, -1);
        return;
      }
      value += char;
      stdout.write('*');
    };

    stdin.on('data', onData);
  });
}

async function main() {
  console.log('Clix Sales System — Create Super Administrator\n');

  const firstName = await promptVisible('First name: ', process.env.ADMIN_FIRST_NAME);
  const lastName = await promptVisible('Last name: ', process.env.ADMIN_LAST_NAME);
  const phone = await promptVisible('Phone: ', process.env.ADMIN_PHONE);
  const email = await promptVisible('Email: ', process.env.ADMIN_EMAIL);
  const username = await promptVisible('Username: ', process.env.ADMIN_USERNAME);
  const password = await promptHidden('Password: ', process.env.ADMIN_PASSWORD);

  if (!firstName || !lastName || !phone || !email || !username || !password) {
    console.error('\nAll fields are required.');
    process.exitCode = 1;
    return;
  }

  if (!isStrongPassword(password)) {
    console.error(`\n${PASSWORD_POLICY_MESSAGE}`);
    process.exitCode = 1;
    return;
  }

  const role = await roleRepository.findByName('Super Administrator');
  if (!role) {
    console.error('\nThe "Super Administrator" role was not found. Run seeders/001_seed_roles_permissions.sql first.');
    process.exitCode = 1;
    return;
  }

  const existing = await userRepository.findByEmailOrUsername(email);
  if (existing) {
    console.error(`\nA user with email "${email}" already exists.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({
    // This script bootstraps the Super Admin for the single default
    // installation (tenant 1, seeded by migration 017) — self-registration
    // in a future phase is what will ever create a second tenant.
    tenantId: 1,
    firstName,
    lastName,
    phone,
    email,
    username,
    passwordHash,
    roleId: role.id,
    branchId: null,
  });

  console.log(`\nSuper Administrator "${user.first_name} ${user.last_name}" (${user.email}) created successfully.`);
}

main()
  .catch((err) => {
    console.error('\nFailed to create admin user:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await pool.end();
  });
