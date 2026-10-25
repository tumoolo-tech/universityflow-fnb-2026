/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // RNTL's async render under a loaded CI runner can exceed Jest's 5s default on the first test
  // of a file (tumo-olo, same stack).
  testTimeout: 20000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Workspace packages ship TypeScript source, so they must be transformed rather than treated
  // as pre-built node_modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@universityflow/.*))',
  ],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
};
