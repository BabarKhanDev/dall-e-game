const { body,validationResult } = require("express-validator");
var couchbase = require('couchbase')
const { getUserBucket, getGameBucket, getCluster} = require('../controllers/connect');  

async function delay(n){
  return new Promise(function(resolve){
    setTimeout(resolve,n*1000);
  });
}

async function buildRedirectOnLoad(){
  var game_bucket = await getGameBucket();
  var game_state = await game_bucket.defaultCollection().get('game-state')
  var time_left =  Math.max(game_state.content['time_to_next_round'] - 3, 1)

  var onLoadFunction = 'async function delay(n){return new Promise(function(resolve){setTimeout(resolve,n*1000);});};async function main(){var username_input = document.getElementById("usernameInput");username_input.setAttribute("value", sessionStorage.getItem("username"));var continueloop = true;while (continueloop){await delay('+time_left+');window.location="prompts";};};main()'

  return onLoadFunction
}

async function checkIfPromptCorrect(guess){
  var game_bucket = await getGameBucket();
  var game_state = await game_bucket.defaultCollection().get('game-state')
  var current_image =  game_state.content['current_image']
  var current_image_sanitized = current_image.slice(0,-4)
  var image_ids = await game_bucket.defaultCollection().get('image-ids')
  correct_prompt = image_ids.content[current_image_sanitized]['prompt']
  hints = image_ids.content[current_image_sanitized]['hints']

  if (guess == correct_prompt){
    return true
  }
  else if(hints.includes(guess)){
    return true
  }
  return false
}

async function upsertGuess(username, guess){
  var game_bucket = await getGameBucket();
  var user_prompts = await game_bucket.defaultCollection();

  await user_prompts.mutateIn('user_prompts', [
    couchbase.MutateInSpec.upsert(username, guess)
  ])
}

async function checkForPhaseOne(){

  var gameBucket = await getGameBucket()
  result = await gameBucket.defaultCollection().get('game-state');
  if(result.content['stage'] == 1){
    return true
  }

  return false
}


//Display Current image on GET
exports.image_get = async function(req, res){
  var started = await checkForPhaseOne()
  if (!started){
    res.render('waitingForPlayers', { title: 'Waiting'})
  }
  else{
    res.render('image', { title: 'Guess the image', onLoadFunction: await buildRedirectOnLoad()})
  }

}

//Handle Username update on POST
exports.image_guess_post = [
  // Validate and sanitize the prompt field.
  body('prompt', 'prompt required').trim().isLength({ min: 1 }).escape().withMessage('prompt must be specified.'),

  // Process request after validation and sanitization.
  async (req, res, next) => {
    // Extract the validation errors from a request.
    var errors = validationResult(req);

    if(!errors.isEmpty()){
      //there are errors. Render the form again with sanitized values/error messages.
      res.render('image', {title: 'Guess the image', errors:errors.array(), onLoadFunction: await buildRedirectOnLoad()});
      return;
    }
    else{
      
      prompt_correct = await checkIfPromptCorrect(req.body.prompt.toLowerCase())

      if(prompt_correct){
        //there are errors. Render the form again with sanitized values/error messages.
        let error = {}  
        error.msg = "your guess was too close to the actual answer"
        promptCorrectError = [error]
        res.render('image', {title: 'Guess the image', errors:promptCorrectError, onLoadFunction: await buildRedirectOnLoad()});
        return;
      }
      else{
        //upload username to db
        await upsertGuess(req.body.username, (req.body.prompt).toLowerCase())
        res.redirect('/prompts')
      }
    }
  }
];