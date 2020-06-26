const express = require('express');
const Logger = require('../logger/logger');

const logger = new Logger({ prefix: 'express-server' });

class ExpressServer {
  constructor(options = {}) {
    const {
      host,
      index,
      port,
      site,
    } = options;

    this.host = host || '0.0.0.0';
    this.index = index;
    this.port = port || '8080';
    this.site = site || './build';
  }

  /**
   * Starts the webpack dev server.
   */
  start() {
    logger.info('Starting the webpack dev server.');

    const startPromise = new Promise((resolve, reject) => {
      this.server = express();

      this.server.use(express.static(this.site, {
        ...this.index && { index: this.index },
        extensions: ['html', 'htm'],
      }));

      this.server.use([/\/[^.]*$/, '/*.html?'], (_req, res, next) => {
        // Return 404.html if provided.
        res.status(404).sendFile('/404.html', { root: this.site }, () => {
          // If there is an error, bail.
          next();
        });
      });

      // Start that server.
      this.server.listen(this.port, this.host, (error) => {
        if (error) {
          reject(error);
        }

        logger.info(`Express server has started listening at ${`http://${this.host}:${this.port}/`}.`);
      });
    });

    return startPromise;
  }

  /**
   * Stops the express server.
   */
  stop() {
    logger.info('Closing the express server.');

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      });
    }

    // Resolve immediately if the server is not available.
    return Promise.resolve();
  }
}

module.exports = ExpressServer;
