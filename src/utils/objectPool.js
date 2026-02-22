export function createObjectPool({ create, reset, max }) {
  const pool = [];

  function acquire() {
    const item = pool.pop();
    if (item) {
      return item;
    }
    return create();
  }

  function release(item) {
    if (pool.length >= max) {
      return;
    }
    reset(item);
    pool.push(item);
  }

  return { acquire, release };
}
