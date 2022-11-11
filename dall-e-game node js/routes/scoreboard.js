var express = require('express');
var router = express.Router();

var scorebaord_controller = require('../controllers/scoreboardController')

router.get('/', scorebaord_controller.scoreboard_get);

module.exports = router;
