var express = require('express');
var router = express.Router();
var username_controller = require('../controllers/usernameController')

router.get('/', username_controller.username_update_get);

router.post('/', username_controller.username_update_post)

module.exports = router;
