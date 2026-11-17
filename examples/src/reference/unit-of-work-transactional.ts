import { isTransactional, localQueryBus, transactional, unitOfWork } from "@kronos-ts/core"

// A persistence package marks the factory it returns
const transactionalUnitOfWork = transactional(unitOfWork)

console.log(isTransactional(unitOfWork), isTransactional(transactionalUnitOfWork))

// The query bus refuses a marked factory when it is built
try {
  // @ts-expect-error a query bus must be built from the plain factory
  localQueryBus(transactionalUnitOfWork)
} catch (error) {
  console.log((error as Error).message)
}
