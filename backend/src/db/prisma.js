const { PrismaClient } = require('../generated/prisma');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabaseUrl ? new PrismaClient() : null;

module.exports = { prisma, hasDatabaseUrl };
