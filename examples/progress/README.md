# Monitoring Progress

<a class="docs-link" href="https://upscalerjs.com/documentation/guides/browser/usage/progress">View this page on the UpscalerJS website</a>

It can be useful to monitor the progress of an upscale operation, particularly for larger images or heavier models. UpscalerJS provides an easy way to do so.

<a href="https://githubbox.com/thekevinscott/upscalerjs/tree/main/examples/progress?file=index.js&title=UpscalerJS: Progress">Open example in Codesandbox</a>.

## Specifying a `progress` Callback Function

:::caution

`progress` will _only_ be called if a `patchSize` is set during an upscale (for models with dynamic sizes). For models with fixed input sizes or divisibility requirements, `progress` will be called automatically. [Read more about patch sizes here](../performance/patch-sizes).

:::

We can pass a callback function to the `upscale` method that will be called upon on any progress operations:

```javascript
import Upscaler from 'upscaler'
import image from '/path/to/image.png'

const upscaler = new Upscaler()

upscaler.upscale(image, {
  progress: (percent) => {
    console.log(`${percent * 100}% of image has been processed`)
  }
})
```

## Callback Function

In addition to returning the percentage of operation completed, the `progress` callback can accept a few positional other arguments. [The full list of arguments is](/documentation/api/upscale#progress):

* `percent` - The percentage of the upscale operation completed
* `imageSlice` - The patch of image being operated upon
* `row` - The row being operated upon
* `col` - The column being operated upon

By default, `imageSlice` will be in the format specified by `output` - e.g., if we've specified an `output` of `tensor`, we'll receive a `tensor` back in the `progress` function.

To change this, we can specify the format we wish to receive in `progress` with `progressOutput`:

```javascript
upscaler.upscale(image, {
  output: 'tensor',
  progressOutput: 'base64',
  progress: (percent, slice) => {
    // our slice will now be a base64 src, even though the response
    // from upscale will be a tensor
    console.log(slice) 
  }
})
```

As in other operations, when receiving a tensor in the progress callback, **we are responsible for disposing of that tensor**. 

```javascript
upscaler.upscale(image, {
  output: 'tensor',
  progress: (percent, slice) => {
    console.log(slice) 

    // Now that we're done with our tensor, dispose of it
    slice.dispose()
  }
})
```

Next, we can learn how to cancel an inflight request.
