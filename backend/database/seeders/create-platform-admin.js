// One-time bootstrap script to create the first Platform Administrator —
// mirrors create-admin.js exactly, minus the role lookup (platform admins
// are a flat, single-role table, see 022_create_platform_admin_tables.sql).
// Run manually: `node backend/database/seeders/create-platform-admin.js`.
// Accepts values via env vars (PLATFORM_ADMIN_FIRST_NAME, _LAST_NAME,
// _EMAIL, _PASSWORD) for non-interactive use, or prompts interactively for
// anything not supplied. No credentials are hardcoded.

import readline from 'readline/promises';
import { stdin, stdout } from 'process';
import { pool } from '../../config/db.js';
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../../utils/passwordPolicy.js';
import { hashPassword } from '../../services/platformAuth.service.js';
import * as platformAdminRepository from '../../repositories/platformAdmin.repository.js';

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
  console.log('Clix Sales System — Create Platform Administrator\n');

  const firstName = await promptVisible('First name: ', process.env.PLATFORM_ADMIN_FIRST_NAME);
  const lastName = await promptVisible('Last name: ', process.env.PLATFORM_ADMIN_LAST_NAME);
  const email = await promptVisible('Email: ', process.env.PLATFORM_ADMIN_EMAIL);
  const password = await promptHidden('Password: ', process.env.PLATFORM_ADMIN_PASSWORD);

  if (!firstName || !lastName || !email || !password) {
    console.error('\nAll fields are required.');
    process.exitCode = 1;
    return;
  }

  if (!isStrongPassword(password)) {
    console.error(`\n${PASSWORD_POLICY_MESSAGE}`);
    process.exitCode = 1;
    return;
  }

  const existing = await platformAdminRepository.findByEmail(email);
  if (existing) {
    console.error(`\nA platform admin with email "${email}" already exists.`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    'INSERT INTO platform_admins (first_name, last_name, email, password_hash, status) VALUES (?, ?, ?, ?, ?)',
    [firstName, lastName, email, passwordHash, 'active'],
  );

  console.log(`\nPlatform Administrator "${firstName} ${lastName}" (${email}) created successfully.`);
}

main()
  .catch((err) => {
    console.error('\nFailed to create platform admin:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await pool.end();
  });
