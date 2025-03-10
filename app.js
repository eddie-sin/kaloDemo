//Importing Modules
const express = require("express");
const morgan = require("morgan");

//Creating App
const app = express();

//MiddleWares - Global
app.use(express.json()); //Middle that adds body to request (body parser)

app.use(morgan("dev"));

//Importing Routers
const caloriLogRouter = require("./routes/CaloriLogRoutes");

//Mounting
app.use("/api/v1/caloriLog", caloriLogRouter);

module.exports = app;
