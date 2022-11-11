var couchbase = require('couchbase')

async function getCluster(){

  const clusterConnStr = 'couchbase://localhost'
  const username = 'Administrator'
  const password = 'password'

  const cluster = await couchbase.connect(clusterConnStr, {
    username: username,
    password: password,
  })

  return cluster
}

async function getGameBucket(){
  cluster = await getCluster()

  return cluster.bucket('game-data')
}

async function getUserBucket(){
  cluster = await getCluster()

  return cluster.bucket('users')
}

exports.getCluster = getCluster
exports.getUserBucket = getUserBucket
exports.getGameBucket = getGameBucket