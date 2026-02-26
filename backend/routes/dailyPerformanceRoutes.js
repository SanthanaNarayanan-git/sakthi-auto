const express = require("express");
const router = express.Router();
const dailyPerformanceController = require("../controllers/dailyPerformanceController");

// Get Routes for auto-calculations
router.get("/daily-performance/summary", dailyPerformanceController.getSummaryByDate);
router.get("/daily-performance/delays", dailyPerformanceController.getDelaysByDateAndDisa);

// ⬇️ NEW ROUTE ADDED HERE FOR PDF DOWNLOAD ⬇️
router.get("/daily-performance/download-pdf", dailyPerformanceController.downloadPDF);

// Post Route for submitting the form
router.post("/daily-performance", dailyPerformanceController.createDailyPerformance);

module.exports = router;