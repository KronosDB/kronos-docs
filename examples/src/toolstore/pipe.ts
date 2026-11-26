/**
 * `pipe(value, first, second)` is `second(first(value))`: a value and the wrappers around it, listed innermost first.
 * Each wrapper may change the type, as a handler wrapper that adds to the context does.
 */
export function pipe<A>(value: A): A
export function pipe<A, B>(value: A, first: (value: A) => B): B
export function pipe<A, B, C>(value: A, first: (value: A) => B, second: (value: B) => C): C
export function pipe<A, B, C, D>(value: A, first: (value: A) => B, second: (value: B) => C, third: (value: C) => D): D
export function pipe<A, B, C, D, E>(
  value: A,
  first: (value: A) => B,
  second: (value: B) => C,
  third: (value: C) => D,
  fourth: (value: D) => E,
): E
export function pipe<A, B, C, D, E, F>(
  value: A,
  first: (value: A) => B,
  second: (value: B) => C,
  third: (value: C) => D,
  fourth: (value: D) => E,
  fifth: (value: E) => F,
): F
export function pipe(value: unknown, ...wrappers: ReadonlyArray<(value: unknown) => unknown>): unknown {
  return wrappers.reduce((wrapped, wrapper) => wrapper(wrapped), value)
}
