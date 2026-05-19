var exec = require('child_process').execSync
var platform = require('os').platform()
var quote = require("shell-quote").quote

module.exports = function(){
  var commands = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.apply(arguments)
  var command = null

  commands.some(function(c){
    if (isExec(findCommand(c))){
      command = c
      return true
    }
  })

  return command
}

function isExec(command){
  try{
    exec(quote(command.split(" ")), { stdio: 'ignore' })
    return true
  }
  catch (_e){
    return false
  }
}

function findCommand(command){
  if (/^win/.test(platform)){
    return "where " + command
  } else {
    return "command -v " + command
  }
}
