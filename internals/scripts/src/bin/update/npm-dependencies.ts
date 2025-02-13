import { exec as _exec, ExecOptions } from 'child_process';
import path from 'path';
import { glob } from 'glob';
import asyncPool from "tiny-async-pool";
import { ROOT_DIR } from '@internals/common/constants';
import { getLogLevel, info } from '@internals/common/logger';

/****
 * Types
 */
interface PNPMLSItem {
  name: string;
  version: string;
  path: string;
  private: boolean;
}

/****
 * Constants
 */
const NUMBER_OF_CONCURRENT_THREADS = 5;

/****
 * Utility functions
 */
const exec = (cmd: string, opts: ExecOptions) => new Promise<void>((resolve, reject) => {
  const spawnedProcess = _exec(cmd, opts, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });

  if (getLogLevel() === 'verbose') {
    spawnedProcess.stdout?.pipe(process.stdout);
  }
});

const getOutput = (cmd: string, { ...opts }: ExecOptions = {}) => new Promise<string>((resolve, reject) => {
  let output = '';
  const spawnedProcess = _exec(cmd, opts, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve(output);
    }
  });

  spawnedProcess.stdout?.on('data', chunk => {
    output += chunk;
  });
});

const getPNPMPackages = async (): Promise<PNPMLSItem[]> => JSON.parse(await getOutput('pnpm m ls --json --depth=-1'));

const getAllNonPNPMPackages = async () => {
  const packages = new Set((await getPNPMPackages()).map((pkg) => `${pkg.path.split(`${ROOT_DIR}/`).pop()}/package.json`));
  const files = await glob('**/package.json', {
    cwd: ROOT_DIR,
    ignore: [
      'node_modules/**', 
      '**/node_modules/**', 
      '**/scratch/**',
      '**/dev/browser/public/**',
      '**/examples/react/**',
    ],
  });
  return files.filter(file => !packages.has(file) && file !== 'package.json');
}

/****
 * Main function
 */

const main = async () => {
  const filteredFiles = await getAllNonPNPMPackages();
  info(`Updating ${filteredFiles.length} packages`);
  for await (const _ of asyncPool(NUMBER_OF_CONCURRENT_THREADS, filteredFiles, async (file: string) => {
    await exec('npm update --save', {
      cwd: path.resolve(ROOT_DIR, path.dirname(file)),
    });
  })) {
    // empty
  }
};

main();
