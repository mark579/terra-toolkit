const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class DockerService {
  constructor(options) {
    this.options = options || {};
  }

  /**
   * Prepares the docker testing environment.
   * @returns {Promise} - A promise that resolves when the testing environment is ready.
   */
  async onPrepare() {
    try {
      await this.initializeSwarm();
      // await this.removeStack();
      await this.deployStack();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Initializes a docker swarm instance.
   * @returns {Promise} - A promise that resolves when the swarm is initialized.
   */
  async initializeSwarm() {
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
    const composeFilePath = path.resolve(__dirname, '../docker/docker-compose.yml');

    return exec(`docker stack deploy -c ${composeFilePath} wdio`);
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

    await exec('docker stack rm wdio');

    return new Promise((resolve, reject) => {
      let retryCount = 0;
      let timeout = null;

      const pollNetwork = async () => {
        if (retryCount >= 10) {
          clearTimeout(timeout);
          timeout = null;
          reject(Error('[terra-functional-testing:wdio-docker-service] Timeout waiting for docker network to shut down.'));
        }

        const { stdout: networkStatus } = await exec('docker network ls | grep wdio || true');

        if (!networkStatus) {
          resolve();
        }

        retryCount++;
        timeout = setTimeout(pollNetwork, 200);
      }

      timeout = setTimeout(pollNetwork, 200);
    });
  }

  /**
   * Removes the docker stack and network.
   * @returns {Promise} - A promise that resolves when the docker stack and network have been removed.
   */
  async onComplete() {
    // return this.removeStack();
  }
}

module.exports = DockerService;
