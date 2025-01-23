require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ownerRoutes = require("./routes/ownerRoutes");
const eventRoutes = require("./routes/eventRoutes");

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/event", eventRoutes);
app.use("/api/owner", ownerRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("StackFlow Server is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
