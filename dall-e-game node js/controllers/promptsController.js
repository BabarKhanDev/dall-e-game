const { body,validationResult } = require("express-validator");
var couchbase = require('couchbase')
const { getUserBucket, getGameBucket, getCluster} = require('../controllers/connect');  

async function buildRedirectOnLoad(){
  var game_bucket = await getGameBucket();
  var game_state = await game_bucket.defaultCollection().get('game-state')
  var time_left =  Math.max(game_state.content['time_to_next_round'] - 3, 1)

  var onLoadFunction = 'async function delay(n){return new Promise(function(resolve){setTimeout(resolve,n*1000);});};async function main(){var username_input = document.getElementsByClassName("usernameInput");for(let i=0; i<username_input.length;i++){username_input[i].setAttribute("value", sessionStorage.getItem("username"));};var users_prompt = document.getElementById(sessionStorage.getItem("username"));users_prompt.setAttribute("class", "promptContainer hidden");var continueloop = true;while (continueloop){await delay('+time_left+');window.location="prompts";};};main()'

  return onLoadFunction
}

async function update_user_score(username, value){
  try {
    var userBucket = await getUserBucket()
    var userBucketCol = await userBucket.defaultCollection()
    await userBucketCol.mutateIn(username, [
      couchbase.MutateInSpec.arrayAppend('total_score', value)
    ])
  } catch (error) {
    console.log(error)
  }
}

async function checkIfGuessCorrect(username, guess){

  //get the correct answer
  var gameBucket = await getGameBucket()
  var game_state = await gameBucket.defaultCollection().get('game-state')
  var current_image =  game_state.content['current_image']
  var current_image_sanitized = current_image.slice(0,-4)
  var image_ids = await gameBucket.defaultCollection().get('image-ids')
  correct_prompt = image_ids.content[current_image_sanitized]['prompt']

  //did you guess correctly? if so you get a point
  if (correct_prompt == guess){
    update_user_score(username, 1)
  }
  
  //if you voted for somebody else, give them a point
  var result = await gameBucket.defaultCollection().get('user_prompts')
  var user_prompts = result.content
  console.log(user_prompts)
  for(var i = 0; i < Object.keys(user_prompts).length; i++){
    keys = Object.keys(user_prompts)
    values = Object.values(user_prompts)
    console.log(guess, values[i])
    if(guess == values[i]){
      update_user_score(keys[i], 1)
    }
  }
  
}

async function upsertGuess(username, guess){

  var game_bucket = await getGameBucket();
  var user_prompt_choices = await game_bucket.defaultCollection();

  await user_prompt_choices.mutateIn('user_prompt_choices', [
    couchbase.MutateInSpec.upsert(username, guess)
  ])
}

async function checkForPhaseTwo(){

  var gameBucket = await getGameBucket()
  result = await gameBucket.defaultCollection().get('game-state');
  if(result.content['stage'] == 2){
    return true
  }

  return false
}

async function getPrompts(){
  //user uploaded prompts
  var gameBucket = await getGameBucket()
  result = await gameBucket.defaultCollection().get('user_prompts');

  var output = []
  for(let i = 0; i<Object.values(result.content).length; i++){
    prompt = new Object();
    prompt.user = Object.keys(result.content)[i];
    prompt.answer = Object.values(result.content)[i];

    output.push(prompt);
  }

  //add the correct prompt
  var game_state = await gameBucket.defaultCollection().get('game-state')
  var current_image =  game_state.content['current_image']
  var current_image_sanitized = current_image.slice(0,-4)
  var image_ids = await gameBucket.defaultCollection().get('image-ids')
  correct_prompt = image_ids.content[current_image_sanitized]['prompt']

  correct_prompt_object = new Object();
  correct_prompt_object.user = ""
  correct_prompt_object.answer = correct_prompt;

  output.push(correct_prompt_object)

  output.sort(()=> Math.random()-0.5)

  return (output)
}

//Display Current image on GET
exports.prompt_get = async function(req, res){
  var started = await checkForPhaseTwo()
  if (!started){
    res.render('waitingForPrompts', { title: 'Waiting'})
  }
  else{
    res.render('prompts', { title: 'Guess the correct prompt', onLoadFunction: await buildRedirectOnLoad(), prompts : await getPrompts()})
  }

}

//Handle Username update on POST
exports.prompt_guess_post = [
  async (req, res, next) => {

    //give a point if the guess is right
    await checkIfGuessCorrect(req.body.username, req.body.prompt)

    //upload username to db
    await upsertGuess(req.body.username, req.body.prompt)
    res.redirect('/scoreboard')
  }
];