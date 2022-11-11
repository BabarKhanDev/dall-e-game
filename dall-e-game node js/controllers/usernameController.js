const { body,validationResult } = require("express-validator");
var couchbase = require('couchbase')
const { getUserBucket, getGameBucket, getCluster} = require('../controllers/connect');  

async function upsertUsername(username){
  var userBucket = await getUserBucket()
  userBucket.defaultCollection().upsert(username, {'username':username, 'total_score':[]})
}

async function checkIfUsernameTaken(){
  var cluster = await getCluster()
  result = await cluster.query('select username from users')

  usernames = []
  for (var i = 0; i <result.rows.length; i++){
    usernames.push(result.rows[i]['username']);
  }
  return usernames
}

//Display Username form on GET
exports.username_update_get = function(req, res){
  res.render('login', { title: 'Create Username'})
}

//Handle Username update on POST
exports.username_update_post = [
  // Validate and sanitize the username field.
  
 
  body('username', 'username required').trim().isLength({ min: 1 }).escape().withMessage('First name must be specified.'),

  // Process request after validation and sanitization.
  async (req, res, next) => {

    // Extract the validation errors from a request.
    var errors = validationResult(req);

    if(!errors.isEmpty()){
      //there are errors. Render the form again with sanitized values/error messages.
      res.render('login', {title: 'Create Username', username: req.body.username , errors:errors.array()});
      return;
    }
    else{
      
      usernames = await checkIfUsernameTaken()

      if(usernames.includes(req.body.username)){
        //there are errors. Render the form again with sanitized values/error messages.
        let error = {}  
        error.msg = "username taken"
        usernameTakenError = [error]
        res.render('login', {title: 'Create Username', username: req.body.username , errors:usernameTakenError});
        return;
      }
      else{
        //upload username to db
        await upsertUsername(req.body.username)
        res.redirect('/image')
      }
    }
  }
];