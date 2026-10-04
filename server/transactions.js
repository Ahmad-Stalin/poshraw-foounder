let localWriteQueue = Promise.resolve()

export async function withWriteTransaction(database, operation) {
  if (typeof database.transaction === 'function') {
    return database.transaction(operation)
  }

  const run = localWriteQueue.then(async () => {
    await database.exec('BEGIN')
    try {
      const result = await operation(database)
      await database.exec('COMMIT')
      return result
    } catch (error) {
      await database.exec('ROLLBACK')
      throw error
    }
  })
  localWriteQueue = run.catch(() => undefined)
  return run
}