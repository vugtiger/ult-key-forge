/** Execution tokens are critical: never deliver a loader until its token is stored. */
export async function persistExecutionToken<T>(insert: (row: T) => PromiseLike<{ error: unknown }>, row: T): Promise<void> {
  const { error } = await insert(row);
  if (error) throw new Error('Unable to initialise loader session. Please retry shortly.');
}