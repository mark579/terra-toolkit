const ExpressServer = require('../express-server/express-server');
const WebpackServer = require('../webpack-server/webpack-server');
const Logger = require('../logger/logger');

const logger = new Logger({ prefix: 'wdio-serve-static-service' });

class WebpackService {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Prepares the service.
   */
  async onPrepare() {
    if (!this.config) {
      logger.warn('No webpack configuration provided.');

      return;
    }

    const { site } = this.options;

    if (site) {
      this.server = new ExpressServer(this.options);
    } else {
      this.server = new WebpackServer(this.options);
    }

    await this.server.start();
  }

  /**
   * Cleans up the service.
   */
  async onComplete() {
    if (this.server) {
      await this.server.stop();

      this.server = null;
    }
  }
}

module.exports = WebpackService;
