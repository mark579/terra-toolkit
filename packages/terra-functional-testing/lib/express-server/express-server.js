const fs = require('fs');
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
   * @returns {Promise} - A promise that resolves when the server has started.
   */
  start() {
    if (!fs.existsSync(this.site) || (fs.lstatSync(this.site).isDirectory() && fs.readdirSync(this.site).length === 0)) {
      logger.warn(`Cannot serve content from ${this.site} because it does not exist or it is empty.`);
      return Promise.reject();
    }

    const startPromise = new Promise((resolve, reject) => {
      logger.info('Starting the express server.');

      const app = express();

      app.use(express.static(this.site, {
        ...this.index && { index: this.index },
        extensions: ['html', 'htm'],
      }));

      app.use([/\/[^.]*$/, '/*.html?'], (_req, res, next) => {
        // Return 404.html if provided.
        res.status(404).sendFile('/404.html', { root: this.site }, () => {
          // If there is an error, bail.
          next();
        });
      });

      // Start that server.
      this.server = app.listen(this.port, this.host, (error) => {
        if (error) {
          reject(error);
        }

        logger.info(`Express server has started listening at ${`http://${this.host}:${this.port}/`}.`);
        resolve();
      });
    });

    return startPromise;
  }

  /**
   * Stops the express server.
   * @returns {Promise} - A promise that resolves when the server has been stopped.
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
