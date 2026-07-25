function notFound(req, res, next) {
  const error = new Error(`Rota nao encontrada: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  res.status(status).json({
    error: {
      message: error.message || 'Erro interno',
      details: error.details || undefined
    }
  });
}

module.exports = { notFound, errorHandler };
