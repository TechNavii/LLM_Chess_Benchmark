// Test setup file for global test configurations
import 'jest';

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      // Add custom matchers here if needed
    }
  }
}

// Mock console.log and other console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to silence console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set test timeout globally
jest.setTimeout(10000);

// Clean up any intervals or timeouts after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Clean up all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});