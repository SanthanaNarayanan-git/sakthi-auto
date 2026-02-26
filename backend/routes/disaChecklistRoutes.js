const express = require('express');
const router = express.Router();
const controller = require('../controllers/disaMachineChecklistController');

// --- Operator & PDF Routes ---
router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport);
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

// --- 🔥 NEW: HOD Dashboard Routes ---
router.get('/hod/:name', controller.getReportsByHOD);
router.post('/sign', controller.signReportByHOD);

module.exports = router;