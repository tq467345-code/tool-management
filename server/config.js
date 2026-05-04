module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production',
  JWT_EXPIRES_IN: '12h',
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 60000,
  RATE_LIMIT: 100,
  RATE_LIMIT_WINDOW: 60000
};
