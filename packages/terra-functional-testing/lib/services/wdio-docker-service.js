/* eslint-disable class-methods-use-this */
const path = require('path');
const util = require('util');
const childProcess = require('child_process');
const Logger = require('../logger/logger');

const exec = util.promisify(childProcess.exec);
const logger = new Logger({ prefix: 'wdio-docker-service' });

const NETWORK_RETRY_COUNT = 60;
const NETWORK_POLL_INTERVAL = 1000;

class DockerService {
  /**
   * Prepares the docker testing environment.
   */
  async onPrepare() {
    await this.initializeSwarm();
    await this.deployStack();
  }

  /**
   * Initializes a docker swarm instance.
   * @returns {Promise} - A promise that resolves when the swarm is initialized.
   */
  async initializeSwarm() {
    logger.log('Initializing docker swarm.');

    const { stdout: dockerInfo } = await exec('docker info --format "{{json .}}"');
    const { Swarm } = JSON.parse(dockerInfo);

    if (Swarm.LocalNodeState === 'active') {
      return Promise.resolve();
    }

    return exec('docker swarm init');
  }

  /**
   * Deploys the docker stack.
   */
  async deployStack() {
    // Remove the previous stack if one exists.
    await this.removeStack();

    logger.log('Deploying docker stack.');

    const composeFilePath = path.resolve(__dirname, '../docker/docker-compose.yml');

    await exec(`docker stack deploy -c ${composeFilePath} wdio`);

    await this.awaitNetworkReady();
  }

  /**
   * Removes the docker stack.
   * @returns {Promise} - A promise that resolves when the docker stack has been removed.
   */
  async removeStack() {
    const { stdout: stackInfo } = await exec('docker stack ls | grep wdio || true');

    if (!stackInfo) {
      return Promise.resolve();
    }

    logger.log('Removing docker stack.');

    await exec('docker stack rm wdio');

    // Ensure the network has been removed.
    return this.awaitNetworkRemoval();
  }

  /**
   * Waits for a command to complete successfully.
   * @param {string} command - The shell command to run.
   * @param {func} callback - A callback function to accept or reject the result of the command. Must return a promise.
   */
  async pollCommand(command, callback) {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      let pollTimeout = null;

      const poll = async () => {
        if (retryCount >= NETWORK_RETRY_COUNT) {
          clearTimeout(pollTimeout);
          pollTimeout = null;
          reject(Error(logger.format('Timeout. Exceeded retry count.')));
        }

        try {
          const result = await exec(command);

          await callback(result).then(() => resolve());
        } catch (error) {
          retryCount += 1;
          pollTimeout = setTimeout(poll, NETWORK_POLL_INTERVAL);
        }
      };

      pollTimeout = setTimeout(poll, NETWORK_POLL_INTERVAL);
    });
  }

  /**
   * Ensures the docker network has been shut down.
   */
  async awaitNetworkRemoval() {
    await this.pollCommand('docker network ls | grep wdio || true', (result) => (
      new Promise((resolve, reject) => {
        const { stdout: networkStatus } = result;

        // Reject if there is an active network returned.
        if (networkStatus) {
          reject();
        } else {
          resolve();
        }
      })));
  }

  /**
   * Ensures the docker network is ready.
   * @returns {Promise} - A promise that resolves when the docker network is ready.
   */
  async awaitNetworkReady() {
    logger.log('Waiting for docker to become ready.');

    await this.pollCommand('curl -sSL http://localhost:4444/wd/hub/status', (result) => (
      new Promise((resolve, reject) => {
        const { stdout } = result;
        const { value } = JSON.parse(stdout);

        if (value.ready) {
          resolve();
        } else {
          reject();
        }
      })));
  }

  /**
   * Removes the docker stack and network.
   */
  async onComplete() {
    await this.removeStack();
  }
}

module.exports = DockerService;
