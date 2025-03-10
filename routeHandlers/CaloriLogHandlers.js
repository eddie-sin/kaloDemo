const axios = require("axios");
const qs = require("querystring");
const dotenv = require("dotenv");
const CaloriLog = require("../models/CaloriLogModel");
const { error } = require("console");
const multer = require("multer");
const Module = require("../edge-impulse-standalone");
const fs = require("fs");
const sharp = require("sharp");

// Set up storage (optional: define file naming)SS
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save images to 'uploads' folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

exports.upload = multer({ storage: storage });

const getOAuthToken = async () => {
  const url = "https://oauth.fatsecret.com/connect/token";

  // Prepare the body with grant_type and scope
  const body = qs.stringify({
    grant_type: "client_credentials",
    scope: "basic",
  });

  const response = await axios.post(url, body, {
    auth: {
      username: process.env.FATSECRET_CLIENT_ID, // Your Client ID
      password: process.env.FATSECRET_CLIENT_SECRET, // Your Client Secret
    },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  // Extract the bearer token from the response
  return response.data.access_token; // You get the access token here
};

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

// Instantiate the classifier
const classifier = new EdgeImpulseClassifier();

const getFoodName = async (imagePath) => {
  await classifier.init();

  try {
    const results = await classifier.classifyImage(imagePath);

    // Get the label with the highest confidence
    console.log(results);
    const foodName = results.results.reduce((max, current) =>
      current.value > max.value ? current : max
    ).label;
    console.log(foodName);
    return foodName;
  } catch (error) {
    console.error("Error classifying image:", error);
    return null;
  }
};

// Create a new CaloriLog
exports.createCaloriLog = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const foodName = await getFoodName(req.file.path);

    if (!foodName) {
      return res.status(400).json({ message: "Food name is required" });
    }

    const token = await getOAuthToken();

    // Step 1: Search for the food
    let searchResponse;
    try {
      console.log("eddie");
      searchResponse = await axios.get(
        "https://platform.fatsecret.com/rest/server.api",
        {
          params: {
            method: "foods.search",
            search_expression: foodName,
            format: "json",
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (err) {
      console.error("API Request Error:", err); // Log error for debugging

      if (err.response) {
        // The request was made, but the server responded with an error status
        return res.status(err.response.status).json({
          message: err.response.data?.message || "API request failed",
          status: err.response.status,
        });
      } else if (err.request) {
        // The request was made, but no response was received
        return res
          .status(500)
          .json({ message: "No response received from API" });
      } else {
        // Something else went wrong
        return res.status(500).json({ message: "Unexpected error occurred" });
      }
    }

    const foods = searchResponse.data.foods?.food;

    if (!foods || foods.length === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    const foodId = foods[0].food_id; // Get the first food's ID

    // Step 2: Get detailed food information
    const detailResponse = await axios.get(
      `https://platform.fatsecret.com/rest/server.api`,
      {
        params: {
          method: "food.get.v2",
          food_id: foodId,
          format: "json",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const foodDetails = detailResponse.data.food;
    const firstServing = foodDetails.servings.serving[0]; // Get first serving

    if (!firstServing) {
      return res.status(404).json({ message: "No serving information found" });
    }

    // Step 3: Extract required nutritional data
    const caloriLogData = {
      foodName: foodDetails.food_name,
      calories: Number(firstServing.calories) || 0,
      macronutrients: {
        protein: Number(firstServing.protein) || 0,
        carbohydrates: Number(firstServing.carbohydrate) || 0,
        fats: Number(firstServing.fat) || 0,
        fiber: Number(firstServing.fiber) || 0,
        sugar: Number(firstServing.sugar) || 0,
        sodium: Number(firstServing.sodium) || 0,
        cholesterol: Number(firstServing.cholesterol) || 0,
      },
      vitamins: {
        vitaminA: Number(firstServing.vitamin_a) || 0,
        vitaminB: 0, // FatSecret API doesn't provide B vitamins explicitly
        vitaminC: Number(firstServing.vitamin_c) || 0,
        vitaminD: 0, // Not provided
        vitaminE: 0, // Not provided
        vitaminK: 0, // Not provided
      },
      minerals: {
        calcium: Number(firstServing.calcium) || 0,
        iron: Number(firstServing.iron) || 0,
        magnesium: 0, // Not provided
        potassium: Number(firstServing.potassium) || 0,
        zinc: 0, // Not provided
      },
    };

    // Step 4: Save to MongoDB
    const newCaloriLog = new CaloriLog(caloriLogData);
    const savedCaloriLog = await newCaloriLog.save();

    // Step 5: Send response
    res.status(201).json(savedCaloriLog);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Get all CaloriLogs
exports.getAllCaloriLogs = async (req, res) => {
  try {
    const caloriLogs = await CaloriLog.find();
    res.status(200).json({
      status: "success",
      result: caloriLogs.length,
      data: {
        caloriLogs,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching CaloriLogs", error });
  }
};
/* 
// Get a specific CaloriLog by ID
exports.getCaloriLogById = async (req, res) => {
  try {
    const caloriLog = await CaloriLog.findById(req.params.id);

    if (!caloriLog) {
      return res.status(404).json({ message: "CaloriLog not found" });
    }

    res.status(200).json(caloriLog);
  } catch (error) {
    res.status(500).json({ message: "Error fetching CaloriLog", error });
  }
};

// Update a CaloriLog by ID
exports.updateCaloriLog = async (req, res) => {
  try {
    const updatedCaloriLog = await CaloriLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedCaloriLog) {
      return res.status(404).json({ message: "CaloriLog not found" });
    }

    res.status(200).json(updatedCaloriLog);
  } catch (error) {
    res.status(400).json({ message: "Error updating CaloriLog", error });
  }
};

// Delete a CaloriLog by ID
exports.deleteCaloriLog = async (req, res) => {
  try {
    const deletedCaloriLog = await CaloriLog.findByIdAndDelete(req.params.id);

    if (!deletedCaloriLog) {
      return res.status(404).json({ message: "CaloriLog not found" });
    }

    res.status(200).json({ message: "CaloriLog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting CaloriLog", error });
  }
}; */
