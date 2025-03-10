const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" }); //to assign env file as environment variables

const app = require("./app");

//1. Connection to Cloud mongodb Database
const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);
mongoose.connect(DB).then(() => console.log("DB connection successful"));

//what environment we are currently in //Development or Production Mode
console.log("Current Environment (mode): ", app.get("env"));

//Start Server
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Server Started on port: ${port}...`);
});
