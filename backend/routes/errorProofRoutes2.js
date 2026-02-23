const express = require('express');
const router = express.Router();
const controller = require('../controllers/errorProofController');

// GET request to fetch data for a specific machine
router.get('/details', controller.getDetails);

// POST request to save the verification checklist and reaction plans
router.post('/save', controller.saveDetails);

module.exports = router;