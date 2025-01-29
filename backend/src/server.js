require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const ownerRoutes = require("./routes/ownerRoutes");
const eventRoutes = require("./routes/eventRoutes");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for frontend requests

// Routes
app.use("/event", eventRoutes);
app.use("/api", apiRoutes);
app.use("/api/owner", ownerRoutes);

// Serve frontend
app.use(express.static(path.join(__dirname, "../../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/build", "index.html"));
});

// Health check
app.get("/", (req, res) => {
  res.send("StackFlow Server is running.");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
