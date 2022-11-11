var express = require('express');
var router = express.Router();

var image_controller = require('../controllers/imageController')

router.get('/', image_controller.image_get);

router.post('/', image_controller.image_guess_post)

module.exports = router;
