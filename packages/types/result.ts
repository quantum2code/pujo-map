export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok<T>(data: T) {
  return { ok: true, data } satisfies Result<T, never>;
}

export function err<E>(error: E) {
  return { ok: false, error } satisfies Result<never, E>;
}

export function match<T, E, R>(
  result: Result<T, E>,
  handlers: {
    ok: (data: T) => R;
    err: (error: E) => R;
  },
) {
  if (result.ok) {
    return handlers.ok(result.data);
  }

  return handlers.err(result.error);
}
