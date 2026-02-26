const express = require('express');
const router = express.Router();
const dmmController = require('../controllers/dmmController');

// Operator Routes
router.get('/details', dmmController.getDetails);
router.post('/save', dmmController.saveDetails);

// Supervisor Routes
router.get('/supervisor/:name', dmmController.getSupervisorReports);
router.post('/sign', dmmController.signSupervisorReport);

module.exports = router;