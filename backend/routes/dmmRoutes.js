const express = require('express');
const router = express.Router();
const dmmController = require('../controllers/dmmController');

router.get('/details', dmmController.getDetails);
router.post('/save', dmmController.saveDetails);

module.exports = router;