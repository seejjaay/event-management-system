export default function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  const errors = err.errors || {};

  // express.json() rejects malformed JSON bodies with this error type
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body.';
  }

  if (status === 500) {
    console.error('[Server Error]', err);
    // Never leak internals to the client in production
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }

  res.status(status).json({
    message,
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
    ...(err.conflict ? { conflict: err.conflict } : {}),   // the clashing event, for VENUE_CLASH / ORGANIZER_OVERLAP
    ...(Object.keys(errors).length ? { errors } : {}),
  });
}

