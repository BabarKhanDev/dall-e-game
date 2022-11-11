var express = require('express');
var router = express.Router();

var prompts_controller = require('../controllers/promptsController')

router.get('/', prompts_controller.prompt_get);

router.post('/', prompts_controller.prompt_guess_post)

module.exports = router;
