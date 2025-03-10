const mongoose = require("mongoose");

const CaloriLogSchema = new mongoose.Schema({
  foodName: {
    type: String,
    required: [true, "Food name is required"],
  },
  calories: {
    type: Number,
  },
  macronutrients: {
    protein: { type: Number, default: 0 },
    carbohydrates: { type: Number, default: 0 },
    fats: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 },
    sodium: { type: Number, default: 0 },
    cholesterol: { type: Number, default: 0 },
  },
  vitamins: {
    vitaminA: { type: Number, default: 0 },
    vitaminB: { type: Number, default: 0 },
    vitaminC: { type: Number, default: 0 },
    vitaminD: { type: Number, default: 0 },
    vitaminE: { type: Number, default: 0 },
    vitaminK: { type: Number, default: 0 },
  },
  minerals: {
    calcium: { type: Number, default: 0 },
    iron: { type: Number, default: 0 },
    magnesium: { type: Number, default: 0 },
    potassium: { type: Number, default: 0 },
    zinc: { type: Number, default: 0 },
  },
  timestamp: {
    type: String,
    default: () => new Date().toISOString().replace("T", " ").substring(0, 19),
  },
});

const CaloriLog = mongoose.model("CaloriLog", CaloriLogSchema);
module.exports = CaloriLog;
