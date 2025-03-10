const express = require("express");
const router = express.Router();
const CaloriLogHandlers = require("../routeHandlers/CaloriLogHandlers");

// Create a new CaloriLog
router.post(
  "/",
  CaloriLogHandlers.upload.single("image"),
  CaloriLogHandlers.createCaloriLog
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
