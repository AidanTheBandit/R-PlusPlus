module.exports = {
  testEnvironment: "node",
  testMatch: ["**/src/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/tests/**",
    "!src/server.js"
  ],
  setupFilesAfterEnv: [],
  verbose: true,
  transformIgnorePatterns: [
    "node_modules/(?!node-fetch)"
  ]
};