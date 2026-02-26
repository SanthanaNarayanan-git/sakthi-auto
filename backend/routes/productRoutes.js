const express = require("express");
const router = express.Router();
const formController = require("../controllers/productController");

// --- Dropdown Data Routes ---
router.get("/components", formController.getComponents);
router.get("/delays", formController.getDelayReasons);
router.get("/employees", formController.getEmployees);
router.get("/incharges", formController.getIncharges);
router.get("/supervisors", formController.getSupervisors);
router.get("/operators", formController.getOperators);

// --- Form Transaction Routes ---
router.get("/forms/last-mould-counter", formController.getLastMouldCounter);
router.get("/forms/last-personnel", formController.getLastPersonnel);
router.post("/forms", formController.createReport);
router.get("/forms/download-pdf", formController.downloadAllReports);

// ⬇️ NEW SUPERVISOR ROUTES ADDED HERE ⬇️
router.get("/forms/supervisor/:name", formController.getReportsBySupervisor);
router.post("/forms/sign", formController.signReport);

module.exports = router;