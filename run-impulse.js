// Load the inferencing WebAssembly module
const Module = require("./edge-impulse-standalone");
const fs = require("fs");
const sharp = require("sharp"); // Image processing library

// Classifier module
let classifierInitialized = false;
Module.onRuntimeInitialized = function () {
  classifierInitialized = true;
};

class EdgeImpulseClassifier {
  async init() {
    if (classifierInitialized) return;
    return new Promise((resolve) => {
      Module.onRuntimeInitialized = () => {
        classifierInitialized = true;
        Module.init();
        resolve();
      };
    });
  }

  async classifyImage(imagePath) {
    if (!classifierInitialized) throw new Error("Module is not initialized");

    // Preprocess image to match Edge Impulse input format
    let rawData = await this._processImage(imagePath);

    // Run classification
    let obj = this._arrayToHeap(rawData);
    let ret = Module.run_classifier(
      obj.buffer.byteOffset,
      rawData.length,
      false
    );
    Module._free(obj.ptr);

    if (ret.result !== 0) {
      throw new Error("Classification failed (err code: " + ret.result + ")");
    }

    // Format the result
    let jsResult = {
      anomaly: ret.anomaly,
      results: [],
    };

    for (let cx = 0; cx < ret.size(); cx++) {
      let c = ret.get(cx);
      jsResult.results.push({ label: c.label, value: c.value });
      c.delete();
    }

    ret.delete();
    return jsResult;
  }

  async _processImage(imagePath) {
    try {
      // Load and preprocess the image
      let image = await sharp(imagePath)
        .resize({ width: 96, height: 96 }) // Resize to 96x96 pixels (match Edge Impulse input)
        .greyscale() // Convert to grayscale if needed
        .normalize() // Normalize pixel values
        .raw()
        .toBuffer();

      return Array.from(new Uint8Array(image)); // Convert to array of numbers
    } catch (error) {
      throw new Error("Failed to process image: " + error.message);
    }
  }

  _arrayToHeap(data) {
    let typedArray = new Float32Array(data);
    let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
    let ptr = Module._malloc(numBytes);
    let heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, numBytes);
    heapBytes.set(new Uint8Array(typedArray.buffer));
    return { ptr: ptr, buffer: heapBytes };
  }
}

// Get the image path from command line arguments
if (!process.argv[2]) {
  return console.error("Requires an image file path");
}

let imagePath = process.argv[2];

// Initialize and run classification on the image
let classifier = new EdgeImpulseClassifier();
classifier
  .init()
  .then(async () => {
    let result = await classifier.classifyImage(imagePath);
    console.log("Classification result:", result);
  })
  .catch((err) => {
    console.error("Failed to initialize classifier", err);
  });
