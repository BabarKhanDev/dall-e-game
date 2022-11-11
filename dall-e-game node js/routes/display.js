var express = require('express');
var router = express.Router();
const { getUserBucket, getGameBucket, getCluster} = require('../controllers/connect');    
var display_controller = require('../controllers/displayController')

router.get('/', display_controller.display_get);



module.exports = router;
