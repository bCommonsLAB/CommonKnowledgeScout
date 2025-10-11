declare module 'better-sqlite3' {
  interface Options {
    readonly?: boolean
    fileMustExist?: boolean
    timeout?: number
    verbose?: ((message?: unknown, ...optionalParams: unknown[]) => void) | null
  }
  interface Statement {
    all<T = unknown>(...params: unknown[]): T[]
    get<T = unknown>(...params: unknown[]): T
    run(...params: unknown[]): { changes: number; lastInsertRowid: number }
  }
  class Database {
    constructor(filename: string, options?: Options)
    prepare(sql: string): Statement
    close(): void
  }
  export default Database
}











