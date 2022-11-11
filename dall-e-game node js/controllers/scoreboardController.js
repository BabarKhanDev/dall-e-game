const {getGameBucket} = require('../controllers/connect');  


async function checkForPhasePhase(phase){

  var gameBucket = await getGameBucket()
  result = await gameBucket.defaultCollection().get('game-state');
  if(result.content['stage'] == phase){
    return true
  }
  return false
}

//Display Current image on GET
exports.scoreboard_get = async function(req, res){
  if (await checkForPhasePhase(1)){
    res.redirect('/image')
  }
  else if(await checkForPhasePhase(5)){
    res.render('finalScoreboard', { title: 'Thank you for playing'})
  }
  else{
    res.render('waitingForPhaseFour', {title: 'waiting for next phase'})
  }

}