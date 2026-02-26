const express = require('express');
const router = express.Router();
const controller = require('../controllers/bottomLevelController');

router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport);
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

// Supervisor Endpoints (Daily Audit)
router.get('/supervisor/:name', controller.getReportsBySupervisor);
router.post('/sign-supervisor', controller.signReportBySupervisor);

// 🔥 NEW: Supervisor NCR Endpoints
router.get('/supervisor-ncr/:name', controller.getNcrReportsBySupervisor);
router.post('/sign-ncr', controller.signNcrBySupervisor);

// HOF Endpoints
router.get('/hof/:name', controller.getReportsByHOF);
router.post('/sign-hof', controller.signReportByHOF);

module.exports = router;