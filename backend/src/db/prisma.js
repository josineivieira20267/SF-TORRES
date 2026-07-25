const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
    })
  : null;

module.exports = { prisma, hasDatabaseUrl };
