/* eslint-disable class-methods-use-this */
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const NETWORK_RETRY_COUNT = 60;
const NETWORK_POLL_INTERVAL = 1000;

class DockerService {
  /**
   * Prepares the docker testing environment.
   * @returns {Promise} - A promise that resolves when the testing environment is ready.
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
    console.log('[terra-functional-testing:wdio-docker-service] Initializing docker swarm.');

    const { stdout: dockerInfo } = await exec('docker info --format "{{json .}}"');
    const { Swarm } = JSON.parse(dockerInfo);

    if (Swarm.LocalNodeState === 'active') {
      return Promise.resolve();
    }

    return exec('docker swarm init');
  }

  /**
   * Deploys the docker stack.
   * @returns {Promise} - A promise that resolves when the docker stack is deployed.
   */
  async deployStack() {
    // Remove the previous stack if one exists.
    await this.removeStack();

    console.log('[terra-functional-testing:wdio-docker-service] Deploying docker stack.');

    const composeFilePath = path.resolve(__dirname, '../docker/docker-compose.yml');

    await exec(`docker stack deploy -c ${composeFilePath} wdio`);

    return this.awaitNetworkReady();
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

    console.log('[terra-functional-testing:wdio-docker-service] Removing docker stack.');

    await exec('docker stack rm wdio');

    // Ensure the network has been removed.
    return this.awaitNetworkRemoval();
  }

  /**
   * Ensures the docker network has been shut down.
   * @returns {Promise} - A promise that resolves when the docker network has been removed.
   */
  async awaitNetworkRemoval() {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      let pollTimeout = null;

      /**
       * Polls the network to verify it has been shut down.
       */
      const pollNetwork = async () => {
        if (retryCount >= NETWORK_RETRY_COUNT) {
          clearTimeout(pollTimeout);
          pollTimeout = null;
          reject(Error('[terra-functional-testing:wdio-docker-service] Timeout waiting for docker network to shut down.'));
        }

        try {
          console.log('[terra-functional-testing:wdio-docker-service] Waiting for docker to be removed.');

          const { stdout: networkStatus } = await exec('docker network ls | grep wdio || true');

          if (!networkStatus) {
            clearTimeout(pollTimeout);
            pollTimeout = null;
            resolve();
          } else {
            retryCount += 1;
            pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
          }
        } catch (error) {
          retryCount += 1;
          pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
        }
      };

      pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
    });
  }

  /**
   * Ensures the docker network is ready.
   * @returns {Promise} - A promise that resolves when the docker network is ready.
   */
  async awaitNetworkReady() {
    console.log('[terra-functional-testing:wdio-docker-service] Waiting for docker to become ready.');

    return new Promise((resolve, reject) => {
      let retryCount = 0;
      let pollTimeout = null;

      const pollNetwork = async () => {
        if (retryCount >= NETWORK_RETRY_COUNT) {
          clearTimeout(pollTimeout);
          pollTimeout = null;
          reject(Error('[terra-functional-testing:wdio-docker-service] Timeout waiting for docker network to be ready.'));
        }

        try {
          const { stdout: networkStatus } = await exec('curl -sSL http://localhost:4444/wd/hub/status');
          const { value } = JSON.parse(networkStatus);

          console.log('[terra-functional-testing:wdio-docker-service] Waiting for docker to become ready.');

          if (value.ready) {
            clearTimeout(pollTimeout);
            pollTimeout = null;
            resolve();
          } else {
            retryCount += 1;
            pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
          }
        } catch (error) {
          retryCount += 1;
          pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
        }
      };

      pollTimeout = setTimeout(pollNetwork, NETWORK_POLL_INTERVAL);
    });
  }

  /**
   * Removes the docker stack and network.
   * @returns {Promise} - A promise that resolves when the docker stack and network have been removed.
   */
  afterSession() {
    console.log('ON COMPLETE');
    return this.removeStack();
    // return Promise.resolve();
  }
}

module.exports = DockerService;
