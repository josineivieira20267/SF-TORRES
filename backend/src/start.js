const { execSync } = require('child_process');

if (process.env.DATABASE_URL) {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  execSync('npx prisma db seed', { stdio: 'inherit' });
}

require('./server');
