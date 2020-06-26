const WebpackDevServer = require('webpack-dev-server');
const webpack = require('webpack');
const Logger = require('../logger/logger');

const logger = new Logger({ prefix: 'webpack-server' });

class WebpackServer {
  constructor(options = {}) {
    const {
      config,
      host,
      index,
      locale,
      port,
      theme,
    } = options;

    this.config = config;
    this.host = host || '0.0.0.0';
    this.index = index || 'index.html';
    this.locale = locale;
    this.port = port || '8080';
    this.theme = theme;
  }

  /**
   * Starts the webpack dev server.
   */
  start() {
    logger.info('Starting the webpack dev server.');

    const startPromise = new Promise((resolve, reject) => {
      const compiler = webpack(this.config);

      // Add a hooks to report when webpack has completed.
      compiler.hooks.done.tap('Done', (stats) => {
        if (stats.hasErrors()) {
          logger.error('Webpack compiled with errors.');
          reject();
        } else {
          logger.info('Webpack compiled successfully.');
          resolve();
        }
      });

      compiler.hooks.failed.tap('Failed', () => {
        logger.error('Webpack failed to compile.');
        reject();
      });

      this.server = new WebpackDevServer(compiler, {
        ...compiler.options.devServer,
        hot: false,
        inline: false,
        liveReload: false,
        host: this.host,
        port: this.port,
        index: this.index,
        stats: {
          colors: true,
          children: false,
        },
      });

      // Start that server.
      this.server.listen(this.port, this.host, (error) => {
        if (error) {
          reject(error);
        }

        logger.info(`Webpack server has started listening on port ${this.port}.`);
      });
    });

    return startPromise;
  }

  /**
   * Stops the webpack dev server.
   */
  stop() {
    logger.info('Closing the webpack dev server.');

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      });
    }

    // Resolve immediately if the server was not available.
    return Promise.resolve();
  }
}

module.exports = WebpackServer;
