var expect = require("expect.js")
var platform = require('os').platform()
var shell = require('./../')

if (/^win/.test(platform)){
  describe('Windows', function(){
    it("returns the first command available", function(){
      var result = shell("unknown", "explorer", "still-unknown")
      expect(result).to.be('explorer')
    })

    it("is okay if one of the bins is missing", function(){
      var result = shell(["unknown", "explorer"])
      expect(result).to.be('explorer')
    })

    it("returns null if command was not found", function(){
      expect(shell(["unknown"])).to.be(null)
    })
  })
} else {
  it("returns the first command available", function(){
    var result = shell("./test/shims/foo", "./test/shims/baz", "./test/shims/bar")
    expect(result).to.be('./test/shims/foo')
  })

  it("is okay if one of the bins is missing", function(){
    var result = shell(["./test/shims/baz", "./test/shims/bar"])
    expect(result).to.be('./test/shims/bar')
  })

  it("returns null if command was not found", function(){
    expect(shell(["./test/shims/baz"])).to.be(null)
  })
}
