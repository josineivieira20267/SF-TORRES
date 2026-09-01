const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

function envValue(key, fallback) {
  return String(process.env[key] || fallback || '').trim();
}

async function upsertAdminUser({ environment, name, email, password, permissions }) {
  if (!email || !password) return;
  await prisma.user.upsert({
    where: { email_environment: { email, environment } },
    update: {
      name,
      role: 'Administrador',
      status: 'Ativo',
      environment,
      permissions,
      passwordHash: bcrypt.hashSync(password, 10)
    },
    create: {
      name,
      email,
      role: 'Administrador',
      status: 'Ativo',
      environment,
      permissions,
      passwordHash: bcrypt.hashSync(password, 10)
    }
  });
}

async function main() {
  const adminPermissions = {
    dashboard: 'edit', tower: 'edit', dailyOps: 'edit', schedules: 'edit', productivity: 'edit',
    employees: 'edit', map: 'edit', measurement: 'edit', reports: 'edit', clients: 'edit',
    services: 'edit', equipment: 'edit', locations: 'edit', users: 'edit', settings: 'edit',
    talentDashboard: 'edit', talents: 'edit', talentNew: 'edit', talentJobs: 'edit', talentApplications: 'edit',
    talentUsers: 'edit', talentSettings: 'edit'
  };

  await upsertAdminUser({
    environment: 'operational',
    name: envValue('DEFAULT_ADMIN_NAME', 'Administrador SF'),
    email: envValue('DEFAULT_ADMIN_EMAIL', 'admin@sftorres.local').toLowerCase(),
    password: envValue('DEFAULT_ADMIN_PASSWORD', 'admin123'),
    permissions: adminPermissions
  });

  await upsertAdminUser({
    environment: 'talents',
    name: envValue('TALENTS_ADMIN_NAME', 'Administrador Talentos'),
    email: envValue('TALENTS_ADMIN_EMAIL', '').toLowerCase(),
    password: envValue('TALENTS_ADMIN_PASSWORD', ''),
    permissions: adminPermissions
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
