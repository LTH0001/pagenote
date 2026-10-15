const path = require('node:path');

function projectArgument(argv, cwd = process.cwd()) {
  const file = argv.find(
    (value) =>
      typeof value === 'string' &&
      /\.(pagenote|page-notes\.json)$/i.test(value),
  );
  return file ? path.resolve(cwd, file) : null;
}

function createProjectLauncher({ open, onError }) {
  let ready = false;
  let pending = [];
  let work = Promise.resolve();
  function drain() {
    if (!ready) return work;
    const batch = pending;
    pending = [];
    for (const file of batch)
      work = work.then(() => open(file)).catch((error) => onError(error, file));
    return work;
  }
  return {
    enqueue(file) {
      if (file) pending.push(file);
      return drain();
    },
    ready() {
      ready = true;
      return drain();
    },
  };
}
module.exports = { projectArgument, createProjectLauncher };
