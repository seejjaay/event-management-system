// Deletes any key that starts with $ or contains a dot, at every depth.
function clean(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
    } else {
      clean(value[key]);
    }
  }
}

export default function sanitize(req, res, next) {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}

