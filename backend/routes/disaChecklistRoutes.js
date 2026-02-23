const express = require('express');
const router = express.Router();
const controller = require('../controllers/disaMachineChecklistController');

router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport); // ✅ Added this line
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

module.exports = router;