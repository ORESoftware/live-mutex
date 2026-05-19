'use strict'
const fs = require('fs')
const path = require('path')

/* istanbul ignore next */
const LCHMOD = fs.lchmod ? 'lchmod' : 'chmod'
/* istanbul ignore next */
const LCHMODSYNC = fs.lchmodSync ? 'lchmodSync' : 'chmodSync'

// fs.readdir could only accept an options object as of node v6
const nodeVersion = process.version
let readdir = (path, options, cb) => fs.readdir(path, options, cb)
let readdirSync = (path, options) => fs.readdirSync(path, options)
/* istanbul ignore next */
if (/^v4\./.test(nodeVersion))
  readdir = (path, options, cb) => fs.readdir(path, cb)

// If a party has r, add x
// so that dirs are listable
const dirMode = mode => {
  if (mode & 0o400)
    mode |= 0o100
  if (mode & 0o40)
    mode |= 0o10
  if (mode & 0o4)
    mode |= 0o1
  return mode
}

const chmodrKid = (p, child, mode, cb) => {
  if (typeof child === 'string')
    return fs.lstat(path.resolve(p, child), (er, stats) => {
      if (er)
        return cb(er)
      stats.name = child
      chmodrKid(p, stats, mode, cb)
    })

  if (child.isDirectory()) {
    chmodr(path.resolve(p, child.name), mode, er => {
      if (er)
        return cb(er)
      fs.chmod(path.resolve(p, child.name), dirMode(mode), cb)
    })
  } else
    fs[LCHMOD](path.resolve(p, child.name), mode, cb)
}


const chmodr = (p, mode, cb) => {
  readdir(p, { withFileTypes: true }, (er, children) => {
    // any error other than ENOTDIR means it's not readable, or
    // doesn't exist.  give up.
    if (er && er.code !== 'ENOTDIR') return cb(er)
    if (er) return fs[LCHMOD](p, mode, cb)
    if (!children.length) return fs.chmod(p, dirMode(mode), cb)

    let len = children.length
    let errState = null
    const then = er => {
      if (errState) return
      if (er) return cb(errState = er)
      if (-- len === 0) return fs.chmod(p, dirMode(mode), cb)
    }

    children.forEach(child => chmodrKid(p, child, mode, then))
  })
}

const chmodrKidSync = (p, child, mode) => {
  if (typeof child === 'string') {
    const stats = fs.lstatSync(path.resolve(p, child))
    stats.name = child
    child = stats
  }

  if (child.isDirectory()) {
    chmodrSync(path.resolve(p, child.name), mode)
    fs.chmodSync(path.resolve(p, child.name), dirMode(mode))
  } else
    fs[LCHMODSYNC](path.resolve(p, child.name), mode)
}

const chmodrSync = (p, mode) => {
  let children
  try {
    children = readdirSync(p, { withFileTypes: true })
  } catch (er) {
    if (er && er.code === 'ENOTDIR') return fs[LCHMODSYNC](p, mode)
    throw er
  }

  if (children.length)
    children.forEach(child => chmodrKidSync(p, child, mode))

  return fs.chmodSync(p, dirMode(mode))
}

module.exports = chmodr
chmodr.sync = chmodrSync
