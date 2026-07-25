const app = require('./app');
const { env } = require('./utils/env');

app.listen(env.PORT, () => {
  console.log(`SF TORRES API rodando em http://127.0.0.1:${env.PORT}`);
});
