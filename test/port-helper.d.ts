/**
 * Port allocation helper for tests
 * Ensures each test file gets a unique, consistent port
 * This allows tests to run serially with independent brokers
 */
/**
 * Get a unique port for the current test file
 *
 * Priority:
 * 1. lmx_port environment variable (for manual override)
 * 2. SUMAN_CHILD_ID (for parallel runs with suman)
 * 3. Hash of test file path (for serial runs - ensures consistency)
 *
 * @param testFilePath - Optional path to test file. If not provided, attempts to detect from call stack
 */
export declare function getTestPort(testFilePath?: string): number;
