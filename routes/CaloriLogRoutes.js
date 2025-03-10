const express = require("express");
const router = express.Router();
const CaloriLogHandlers = require("../routeHandlers/CaloriLogHandlers");

// Create a new CaloriLog
router.post(
  "/",
  CaloriLogHandlers.upload.single("image"),
  CaloriLogHandlers.createCaloriLog
);

router.post("/apple", CaloriLogHandlers.createApple);

router.post("/chicken", CaloriLogHandlers.createChicken);

router.post(
  "/cabbage",

  CaloriLogHandlers.createCabbage
);
router.post(
  "/orange",

  CaloriLogHandlers.createOrange
);
router.post(
  "/banana",

  CaloriLogHandlers.createBanana
);
router.post(
  "/coffee",

  CaloriLogHandlers.createCoffee
);

// Get all CaloriLogs
router.get("/", CaloriLogHandlers.getAllCaloriLogs);

/* // Get a specific CaloriLog by ID
router.get("/:id", CaloriLogHandlers.getCaloriLogById);

// Update a CaloriLog by ID
router.put("/:id", CaloriLogHandlers.updateCaloriLog);

// Delete a CaloriLog by ID
router.delete("/:id", CaloriLogHandlers.deleteCaloriLog); */

module.exports = router;
