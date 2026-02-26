const express = require("express");
const router = express.Router();
const controller = require("../controllers/errorProofController");

// ✅ ADD THIS (YOU ARE MISSING IT)
router.post("/save", controller.saveDetails);

router.get("/details", controller.getDetails);
router.get("/report", controller.generateReport);
router.get("/hof/:name", controller.getHofReports);
router.post("/sign-hof", controller.signHof);
router.get("/supervisor/:name", controller.getSupervisorReports);
router.post("/sign-supervisor", controller.signSupervisor);

module.exports = router;