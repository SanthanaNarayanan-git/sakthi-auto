const express = require("express");
const router = express.Router();
const dailyPerformanceController = require("../controllers/dailyPerformanceController");

// Get Routes for auto-calculations
router.get("/daily-performance/summary", dailyPerformanceController.getSummaryByDate);
router.get("/daily-performance/delays", dailyPerformanceController.getDelaysByDateAndDisa);

// Add these with your other daily-performance routes:

// HOF Routes
router.get("/daily-performance/hof/:name", dailyPerformanceController.getHofReports);
router.post("/daily-performance/sign-hof", dailyPerformanceController.signHof);

// HOD Routes
router.get("/daily-performance/hod/:name", dailyPerformanceController.getHodReports);
router.post("/daily-performance/sign-hod", dailyPerformanceController.signHod);

// Add this under your other /daily-performance GET routes
router.get("/daily-performance/users", dailyPerformanceController.getFormUsers);

// ⬇️ NEW ROUTE ADDED HERE FOR PDF DOWNLOAD ⬇️
router.get("/daily-performance/download-pdf", dailyPerformanceController.downloadPDF);

// Post Route for submitting the form
router.post("/daily-performance", dailyPerformanceController.createDailyPerformance);

module.exports = router;