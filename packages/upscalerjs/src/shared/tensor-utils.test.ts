import * as tfn from '@tensorflow/tfjs-node';
import { vi } from 'vitest';
import { Tensor4D, ones, tensor } from '@tensorflow/tfjs-node';
import {
  padInput,
  trimInput,
  scaleIncomingPixels,
  scaleOutput,
  getWidthAndHeight,
  tensorAsClampedArray,
  concatTensors,
  getCopyOfInput,
} from './tensor-utils.js';
import {
  isValidRange,
  isFixedShape4D,
 } from '../../../shared/src/constants';
import {
  GET_INVALID_SHAPED_TENSOR,
  GET_UNDEFINED_TENSORS_ERROR,
} from './errors-and-warnings.js';

import type * as sharedConstants from '../../../shared/src/constants';

vi.mock('@tensorflow/tfjs-node', async () => {
  const tf = await vi.importActual('@tensorflow/tfjs-node') as typeof tfn;
  return {
    ...tf,
    registerOp: vi.fn(),
    loadLayersModel: vi.fn(),
    loadGraphModel: vi.fn(),
  };
});

vi.mock('../../../shared/src/constants', async () => {
  const { isTensor, isValidRange, isFixedShape4D, ...rest } = await vi.importActual('../../../shared/src/constants') as typeof sharedConstants;
  return {
    ...rest,
    isTensor: vi.fn().mockImplementation(isTensor),
    isFixedShape4D: vi.fn().mockImplementation(isFixedShape4D),
    isValidRange: vi.fn().mockImplementation(isValidRange),
  };
});

describe('padInput', () => {
  beforeEach(() => {
    vi.mocked(isFixedShape4D).mockImplementation(() => true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('just returns the input if inputSize is less than the shape of the tensor', () => {
    const t = ones([1, 4, 4, 3]) as Tensor4D;
    expect(padInput(tfn, [null, 2, 2, 3])(t)).toEqual(t);
  });

  it('just returns the input if inputSize is equal to the width of the tensor', () => {
    const t = ones([1, 4, 8, 3]) as Tensor4D;
    expect(padInput(tfn, [null, 4, 4, 3])(t)).toEqual(t);
  });

  it('just returns the input if inputSize is equal to the height of the tensor', () => {
    const t = ones([1, 8, 4, 3]) as Tensor4D;
    expect(padInput(tfn, [null, 4, 4, 3])(t)).toEqual(t);
  });

  it('returns an image with padding if input size is greater than image', () => {
    const t = ones([1, 4, 4, 3]) as Tensor4D;
    const result = padInput(tfn, [null, 6, 6, 3])(t);
    expect(result).not.toEqual(t);
    expect(result.shape).toEqual([1, 6, 6, 3]);
  });

  it('returns an image with padding if input size is greater than the height', () => {
    const t = ones([1, 4, 8, 3]) as Tensor4D;
    const result = padInput(tfn, [null, 6, 6, 3])(t);
    expect(result).not.toEqual(t);
    expect(result.shape).toEqual([1, 6, 8, 3]);
  });

  it('returns an image with padding if input size is greater than the width', () => {
    const t = ones([1, 8, 4, 3]) as Tensor4D;
    const result = padInput(tfn, [null, 6, 6, 3])(t);
    expect(result).not.toEqual(t);
    expect(result.shape).toEqual([1, 8, 6, 3]);
  });
});

describe('trimInput', () => {
  it('just returns the input if width and height are equal to pixels shape', () => {
    const t = ones([1, 4, 4, 3]) as Tensor4D;
    expect(trimInput(tfn, [1, 4, 4, 3], 1)(t)).toEqual(t);
  });

  it('returns a sliced image if image height is smaller than pixels height', () => {
    const t = ones([1, 4, 4, 3]) as Tensor4D;
    const result = trimInput(tfn, [1, 2, 4, 3], 1)(t);
    expect(result).not.toEqual(t);
    expect(result.shape).toEqual([1, 2, 4, 3]);
  });

  it('returns a sliced image if image width is smaller than pixels width', () => {
    const t = ones([1, 4, 4, 3]) as Tensor4D;
    const result = trimInput(tfn, [1, 4, 2, 3], 1)(t);
    expect(result).not.toEqual(t);
    expect(result.shape).toEqual([1, 4, 2, 3]);
  });
});

describe('scaleOutput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns tensor unchanged if input shape is not valid', () => tfn.tidy(() => {
    isValidRange.mockImplementationOnce(() => false);
    const tensor = ones([1, 2, 2, 1]) as Tensor4D;
    expect(Array.from(scaleOutput()(tensor).dataSync())).toEqual(Array.from(tensor.dataSync()));
  }));

  it('returns same tensor values if input shape is 0-255', () => tfn.tidy(() => {
    isValidRange.mockImplementationOnce(() => true);
    const tensor = ones([1, 2, 2, 1]) as Tensor4D;
    expect(Array.from(scaleOutput([0, 255])(tensor).dataSync())).toEqual(Array.from(tensor.dataSync()));
  }));

  it('returns multiplied tensor values if input shape is 0-1', () => tfn.tidy(() => {
    isValidRange.mockImplementationOnce(() => true);
    const tensor = ones([1, 2, 2, 1]) as Tensor4D;
    expect(Array.from(scaleOutput([0, 1])(tensor).dataSync())).toEqual([255, 255, 255, 255,]);
  }));
});

describe('getWidthAndHeight', () => {
  it('throws if given a too small tensor', () => {
    const t = tfn.zeros([2, 2]) as unknown as tfn.Tensor3D;
    expect(() => getWidthAndHeight(t)).toThrow(GET_INVALID_SHAPED_TENSOR(t.shape));
  });

  it('throws if given a too large tensor', () => {
    const t = tfn.zeros([2, 2, 2, 2, 2]) as unknown as tfn.Tensor3D;
    expect(() => getWidthAndHeight(t)).toThrow(GET_INVALID_SHAPED_TENSOR(t.shape));
  });

  it('returns width and height for a 4d tensor', () => {
    expect(getWidthAndHeight(tfn.zeros([1, 2, 3, 4]) as tfn.Tensor4D)).toEqual([2, 3]);
  });

  it('returns width and height for a 3d tensor', () => {
    expect(getWidthAndHeight(tfn.zeros([1, 2, 3]) as tfn.Tensor3D)).toEqual([1, 2]);
  });
});

describe('scaleIncomingPixels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unadulterated incoming pixels if given no range', () => tfn.tidy(() => {
    const result = Array.from(scaleIncomingPixels(tfn)(tfn.tensor4d([[[[0, 127, 255]]]])).dataSync());
    expect(result).toEqual([0, 127, 255]);
  }));

  it('returns unadulterated incoming pixels if given a range of 0-1', () => tfn.tidy(() => {
    const result = Array.from(scaleIncomingPixels(tfn, [0,255])(tfn.tensor4d([[[[0, 127, 255]]]])).dataSync());
    expect(result).toEqual([0, 127, 255]);
  }));

  it('scales incoming pixels if given a range of 0-255', () => tfn.tidy(() => {
    const result = Array.from(scaleIncomingPixels(tfn, [0,1])(tfn.tensor4d([[[[0, 127, 255]]]])).dataSync().map(n => Math.round(n * 100) / 100));
    expect(result).toEqual([0,.5,1]);
  }));
});

describe('tensorAsClampedArray', () => {
  it('returns an array', () => {
    const result = tensorAsClampedArray(tfn, tensor([[[2, 2, 3], [2, 1, 4], [5, 5, 5], [6, 6, 6], [7, 7, 7], [8, 8, 8]]]))
    expect(Array.from(result)).toEqual([2, 2, 3, 255, 2, 1, 4, 255, 5, 5, 5, 255, 6, 6, 6, 255, 7, 7, 7, 255, 8, 8, 8, 255]);
  });

  it('returns a clamped array', () => {
    const result = tensorAsClampedArray(tfn, tensor([[[-100, 2, 3], [256, 1, 4], [500, 5, 5], [6, 6, 6]]]))
    expect(Array.from(result)).toEqual([0, 2, 3, 255, 255, 1, 4, 255, 255, 5, 5, 255, 6, 6, 6, 255]);
  });
});

describe('concatTensors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('concats two tensors together', () => {
    const a: tfn.Tensor3D = tfn.tensor(
      [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4],
      [2, 2, 3,],
    );
    const b: tfn.Tensor3D = tfn.tensor(
      [10, 10, 10, 20, 20, 20, 30, 30, 30, 40, 40, 40],
      [2, 2, 3,],
    );
    const axis = 1;
    const expected = tfn.concat([a, b], axis);
    const result = concatTensors(tfn, [a, b], axis);
    expect(result.shape).toEqual([2, 4, 3])
    expect(result.dataSync()).toEqual(expected.dataSync());
    expect(a.isDisposed).toBe(true);
    expect(b.isDisposed).toBe(true);
  });

  it('throws if given no tensors', () => {
    expect(() => concatTensors(tfn, [undefined, undefined])).toThrowError(GET_UNDEFINED_TENSORS_ERROR);
  });
});

describe('getCopyOfInput', () => {
  it('returns non-tensor input unadulterated', () => {
    const input = { foo: 'foo' } as any;
    expect(getCopyOfInput(input)).toEqual(input);
  });

  it('returns a copy of a given 4d tensor', () => {
    const input: tfn.Tensor4D = tfn.tensor(
      [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4,],
      [1, 2, 2, 3,],
    );
    expect(getCopyOfInput(input)).not.toEqual(input);
  });

  it('returns a copy of a given 3d tensor', () => {
    const input: tfn.Tensor3D = tfn.tensor(
      [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4,],
      [2, 2, 3,],
    );
    expect(getCopyOfInput(input)).not.toEqual(input);
  });
});
