const { defineConfig } = require('cypress');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;

function loadConfig() {
  const p = path.resolve(ROOT, 'config', 'config.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = defineConfig({
  viewportWidth: 1280,
  viewportHeight: 800,
  defaultCommandTimeout: 8000,
  video: false,
  chromeWebSecurity: false,

  e2e: {
    setupNodeEvents(on, config) {
      const appConfig = loadConfig();
      const environment = config.env.environment || 'local';
      const envConfig = appConfig.environments[environment];
      if (!envConfig) {
        throw new Error(`Unknown environment "${environment}". Known: ${Object.keys(appConfig.environments).join(', ')}`);
      }

      config.baseUrl = envConfig.baseUrl;
      config.env = {
        ...config.env,
        adminBaseUrl: envConfig.adminBaseUrl,
        apiBaseUrl: envConfig.apiBaseUrl,
        loginCredentials: appConfig.loginCredentials,
      };

      return config;
    },
  },
});
