/****
 * Tests that different approaches to loading a model all load correctly
 */
import Upscaler, { ModelDefinition } from 'upscaler';
import path from 'path';
import * as tf from '@tensorflow/tfjs';
import type { Page } from 'puppeteer';
import { ClientsideTestRunner } from '@internals/test-runner/clientside';

const LOWER_THRESHOLD = 40; // in milliseconds
const UPPER_THRESHOLD = 20; // in milliseconds
const DATE_AT_WHICH_SPEED_TESTS_TAKE_EFFECT = new Date('December 31, 2023 00:00:00');

const ROOT_BUNDLER_OUTPUT_DIR = process.env.ROOT_BUNDLER_OUTPUT_DIR;
if (typeof ROOT_BUNDLER_OUTPUT_DIR !== 'string') {
  throw new Error('ROOT_BUNDLER_OUTPUT_DIR not defined in env');
}
const ESBUILD_DIST = path.resolve(ROOT_BUNDLER_OUTPUT_DIR, 'esbuild/dist')

describe('Speed Integration Tests', () => {
  const testRunner = new ClientsideTestRunner({
    name: 'esm',
    mock: true,
    dist: ESBUILD_DIST,
  });

  let pages: Page[] = [];

  beforeAll(async function beforeAll() {
    await testRunner.beforeAll();
  }, 60000);

  afterAll(async function modelAfterAll() {
    await testRunner.afterAll();
  }, 10000);

  beforeEach(async function beforeEach() {
    await testRunner.beforeEach('| Loaded');
  });

  afterEach(async function afterEach() {
    pages.forEach(page => {
      try {
        page.close();
      } catch (err) { }
    });
    pages = [];
    await testRunner.afterEach();
  });

  if (new Date().getTime() > DATE_AT_WHICH_SPEED_TESTS_TAKE_EFFECT.getTime()) {
    console.log('The date is after', DATE_AT_WHICH_SPEED_TESTS_TAKE_EFFECT, 'running speed tests!');
    [
      {
        label: 'Simple Model',
        packageName: 'pixel-upsampler',
        modelName: '4x',
      },
      {
        label: 'GANS',
        packageName: 'esrgan-legacy',
        modelName: 'gans',
      },
    ].forEach(({ label, packageName, modelName }) => {
      it(`ensures that UpscalerJS running a ${label} does not add significant additional latency as compared to running the model directly`, async () => {
        const times = 7;
        const durations = await Promise.all(Array(times).fill('').map(async () => {
          const context = await testRunner.browser.createIncognitoBrowserContext();
          const page = await context.newPage();
          pages.push(page);
          await page.goto(testRunner.serverURL);
          // await page.waitForFunction(`document.title.endsWith("| Loaded}")`);
          return page.evaluate(([packageName, modelName]) => new Promise<[number, number]>(resolve => {
            const upscaler = new window['Upscaler']({
              model: (window as any)[packageName][modelName],
            });
            const fixturePath = window['fixtures'][packageName];
            const waitForImage = (src: string): Promise<HTMLImageElement> => new Promise(resolve => {
              const img = new Image();
              img.src = src;
              img.onload = () => resolve(img);
            });
            const measure = (fn: () => Promise<any>) => new Promise(r => {
              const start = performance.now();
              return fn().then(() => r(performance.now() - start));
            })
            return waitForImage(fixturePath).then(img => {
              const fixturePixels = tf.browser.fromPixels(img).expandDims(0) as tf.Tensor4D;
              return Promise.all([
                upscaler.getModel(),
                upscaler.warmup([{
                  patchSize: img.width,
                  padding: 0,
                }]),
              ]).then(([{ model }]) => {
                return measure(() => new Promise(r => {
                  tf.tidy(() => model.predict(fixturePixels));
                  r(undefined);
                })).then(rawDuration => {
                  let output: undefined | tf.Tensor = undefined;
                  return measure(() => upscaler.execute(fixturePixels, {
                    output: 'tensor',
                  })).then(upscalerJSDuration => {
                    if (output !== undefined) {
                      output.dispose();
                    }
                    return [rawDuration, upscalerJSDuration] as [number, number];
                  });
                });
              });
            }).then(resolve);
          }), [packageName, modelName]);
        }));
      });

      it(`ensures that UpscalerJS running a ${label} does not add significant additional latency as compared to running the model directly with patch sizes`, async () => {
        const times = 7;
        const durations = await Promise.all(Array(times).fill('').map(async () => {
          const context = await testRunner.browser.createIncognitoBrowserContext();
          const page = await context.newPage();
          pages.push(page);
          await page.goto(testRunner.serverURL);
          // await page.waitForFunction(`document.title.endsWith("| Loaded}")`);
          return page.evaluate(([packageName, modelName]) => new Promise<[number, number]>(resolve => {
            const patchSize = 8;
            const times = 4;
            const upscaler = new window['Upscaler']({
              model: (window as any)[packageName][modelName],
            });
            const fixturePath = window['fixtures'][packageName];
            const waitForImage = (src: string): Promise<HTMLImageElement> => new Promise(resolve => {
              const img = new Image();
              img.src = src;
              img.onload = () => resolve(img);
            });
            const measure = (fn: () => Promise<any>) => new Promise(r => {
              const start = performance.now();
              return fn().then(() => r(performance.now() - start));
            })
            return waitForImage(fixturePath).then(img => {
              const fixturePixels = tf.browser.fromPixels(img).expandDims(0) as tf.Tensor4D;
              return Promise.all([
                upscaler.getModel(),
                upscaler.warmup([{
                  patchSize,
                  padding: 0,
                }]),
              ]).then(([{ model }]) => {
                return measure(() => new Promise(r => {
                  tf.tidy(() => {
                    for (let i = 0; i < times; i++) {
                      model.predict(fixturePixels);
                    }
                  });
                  r(undefined);
                })).then(rawDuration => {
                  let output: undefined | tf.Tensor = undefined;
                  return measure(() => upscaler.execute(fixturePixels, {
                    output: 'tensor',
                    patchSize,
                    padding: 0,
                  })).then(upscalerJSDuration => {
                    if (output !== undefined) {
                      output.dispose();
                    }
                    return [rawDuration, upscalerJSDuration] as [number, number];
                  });
                });
              });
            }).then(resolve);
          }), [packageName, modelName]);
        }));
        let rawDuration = 0;
        let upscalerJSDuration = 0;
        for (const [raw, upscalerJS] of durations) {
          rawDuration += raw;
          upscalerJSDuration += upscalerJS;
        }

        rawDuration /= times;
        upscalerJSDuration /= times;

        console.log('patch size: raw duration', rawDuration)
        console.log('patch size: upscalerJS Duration', upscalerJSDuration)

        expect(upscalerJSDuration).toBeWithin([rawDuration, LOWER_THRESHOLD, UPPER_THRESHOLD]);
      });
    });
  } else {
    it('passes', () => {
      expect(1).toEqual(1);
    })
  }
});

declare global {
  interface Window {
    Upscaler: typeof Upscaler;
    fixtures: Record<string, string>;
    tf: typeof tf;
    'pixel-upsampler': Record<string, ModelDefinition>;
    'esrgan-legacy': Record<string, ModelDefinition>;
    PixelUpsampler2x: ModelDefinition;
  }
}
