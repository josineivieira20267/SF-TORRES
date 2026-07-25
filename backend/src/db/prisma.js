const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
if (!hasDatabaseUrl) {
  throw new Error('DATABASE_URL nao configurada. O sistema exige PostgreSQL e nao usa banco local.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

module.exports = { prisma, hasDatabaseUrl };
