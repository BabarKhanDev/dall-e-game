const { body,validationResult } = require("express-validator");
var couchbase = require('couchbase')
const { getUserBucket, getGameBucket, getCluster} = require('../controllers/connect');  
const ROUND_TOTAL = 5

async function getUserScores(extra_delay=0){
  try {
    //query the cluster to get a dictionary of all usernames and scores
    var cluster = await getCluster();
    var result = await cluster.query('select username, ARRAY_SUM(total_score) as score from users order by score desc')
    
    var scores = []
    for(let i = 0; i<result.rows.length; i++){
      //loop through results and add to scores list
      var score = new Object();
      score.user = result.rows[i]['username'];
      score.points = result.rows[i]['score'];
      score.delay = 'animation-delay:'+String(2*(result.rows.length - i)-1+extra_delay)+'s'
      scores.push(score);
    }
    return scores

  } catch (error) {
    return []
  }

}
async function getCorrectPrompt(){

  try {
    let gameBucket = await getGameBucket()
    gameBucket = await gameBucket.defaultCollection()
    var result = await gameBucket.get('game-state')

    current_image = result.content['current_image'].slice(0, -4)

    var result = await gameBucket.get('image-ids')
    currentPrompt = result.content[current_image]['prompt']

    prompt = new Object()
    prompt.answer = currentPrompt
    prompt.user = "CORRECT ANSWER"

    return prompt
  } catch (error) {
    console.log("current image not present yet")
  }
}

exports.display_get = async function (req, res, next) {

  var gameBucket = await getGameBucket()
  var result = await gameBucket.defaultCollection().get('game-state')
  var stage = result.content['stage']
  var round = result.content['round']
  var current_image_src = 'images/'+result.content['current_image']
  var correct_prompt = await getCorrectPrompt()

  if (stage == 0){

    var cluster = await getCluster();
    var query = 'select username from users'
    result = await cluster.query(query)
    users=[]
    result.rows.forEach((row) => {
      users.push(row['username'])
    });

    res.render('display'+stage , {msg : 'Stage '+stage, users: users})
  }
  if( stage == 1){
    res.render('display'+stage , {msg : 'Stage '+stage, image : current_image_src, round:round})
  }
  else if(stage == 2){

    var prompt_dict = await gameBucket.defaultCollection().get('user_prompts')
    var prompts = []  

    var prompt_choice_dict = await gameBucket.defaultCollection().get('user_prompt_choices')
    prompt_choices = []

    //these are the prompt suggestions
    for (let i= 0; i < Object.keys(prompt_dict.content).length; i++){
      prompt = new Object()
      prompt.user = ""
      prompt.answer = prompt_dict.content[Object.keys(prompt_dict.content)[i]]
      prompts.push(prompt)
    }

    //add the real prompt
    prompts.push(correct_prompt)        
    prompts.sort(()=> Math.random()-0.5)
    res.render('display'+stage , {msg : 'Stage '+stage, prompts : prompts, image: current_image_src})

  }
  else if(stage == 3){

    var prompt_choice_dict = await gameBucket.defaultCollection().get('user_prompt_choices')
    prompt_choices = []

    //these are what people thought were the real one
    for (let i= 0; i < Object.keys(prompt_choice_dict.content).length; i++){
      prompt = new Object()
      prompt.user = Object.keys(prompt_choice_dict.content)[i]
      prompt.answer = prompt_choice_dict.content[Object.keys(prompt_choice_dict.content)[i]]
      prompt_choices.push(prompt)

    }

    //get the dictionary of all user submitted prompts
    var prompt_dict = await gameBucket.defaultCollection().get('user_prompts')
    
    prompt_dict.content["CORRECT ANSWER"] = correct_prompt.answer

    var prompts = []  

    for (let i= 0; i < Object.keys(prompt_dict.content).length; i++){
      prompt = new Object()
      prompt.user = Object.keys(prompt_dict.content)[i]
      prompt.answer = prompt_dict.content[Object.keys(prompt_dict.content)[i]]
      
      prompt.point = []
      for (let j = 0; j < prompt_choices.length; j++){
        if (prompt_choices[j].answer==prompt.answer){
          //this person had their prompt guessed
          prompt.point.push((prompt_choices[j].user)[0])
        }
      }

      prompts.push(prompt)
    }

    prompts.sort(()=> Math.random()-0.5)

    //compile the scores and then send it off
    var scores = await getUserScores(5)

    var hide_scores_on_round_final = 'hidden'
    if (round != ROUND_TOTAL-1){
      hide_scores_on_round_final = ''
    } 
    
    res.render('display'+stage , {msg : 'Stage '+stage, prompts : prompts, image: current_image_src, scores : scores, hide_score: hide_scores_on_round_final})
  }
  else if(stage == 4){
    res.render('display'+stage , {msg : 'loading'})
  }
  else if(stage == 5){
    var scores = await getUserScores()
    res.render('display'+stage , {msg : 'Stage '+stage, scores : scores})
  }
  else{
    res.render('display'+stage , {msg : 'Stage '+stage})
  }

}
