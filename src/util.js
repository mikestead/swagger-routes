'use strict'

const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const assert = require('assert')
const yaml = require('js-yaml')
const dirname = require('path').dirname

exports.exists = exists
exports.existsSync = existsSync
exports.mkdir = mkdir
exports.readFile = readFile
exports.writeFile = writeFile
exports.writeFileSync = writeFileSync
exports.renameFile = renameFile
exports.readDir = readDir
exports.parseFileContents = parseFileContents
exports.resolveSchemaRefs = resolveSchemaRefs
exports.isFunc = isFunc
exports.isObj = isObj

function exists(filePath) {
  return new Promise((res, rej) =>
    fs.lstat(filePath, (err, stats) =>
      err ? rej(err) : res(stats)))
}

function existsSync(filePath) {
  try {
    return fs.lstatSync(filePath)
  } catch (e) {
    return false
  }
}

function mkdir(dirPath) {
  return new Promise((res, rej) =>
    mkdirp(dirPath, err =>
      err && err.code !== 'EEXIST' ? rej(err) : res()))
}

function readFile(filePath) {
  return new Promise((res, rej) =>
    fs.readFile(filePath, 'utf8', (err, contents) =>
      err ? rej(err) : res(contents)))
}

function writeFile(filePath, contents) {
  return new Promise((res, rej) =>
    mkdir(dirname(filePath)).then(() =>
      fs.writeFile(filePath, contents, err =>
        err ? rej(err) : res())))
}

function writeFileSync(filePath, contents) {
  mkdirp.sync(dirname(filePath))
  fs.writeFileSync(filePath, contents)
}

function renameFile(oldPath, newPath) {
  return new Promise((res, rej) =>
    fs.rename(oldPath, newPath, err =>
      err ? rej(err) : res()))
}

function readDir(dirPath) {
  return new Promise((res, rej) =>
    fs.readdir(dirPath, (err, files) =>
      err ? rej(err) : res(files)))
}

function parseFileContents(contents, path) {
  return isYamlFile(path) ?
    yaml.safeLoad(contents) :
    JSON.parse(contents)
}

function isYamlFile(filePath) {
  return path.extname(filePath).match(/^\.ya?ml$/)
}

const dataCache = new Set()

/**
 * Recursively resolves references in the form `#/path/to/object`.
 *
 * @param {object} data the object to search for and update refs
 * @param {object} lookup the object to clone refs from
 * @returns {*} the resolved data object
 */
function resolveSchemaRefs(data, lookup) {
  if (!data || dataCache.has(data)) return data

  if (Array.isArray(data)) {
    return data.map(item => resolveSchemaRefs(item, lookup))
  } else if (typeof data === 'object') {
    if (data.$ref) {
      const resolved = resolveSchemaRef(data.$ref, lookup)
      delete data.$ref
      data = Object.assign({}, resolved, data)
    }
    dataCache.add(data)

    for (let name in data) {
      data[name] = resolveSchemaRefs(data[name], lookup)
    }
  }
  return data
}

function resolveSchemaRef(ref, lookup) {
  const parts = ref.split('/')

  assert.ok(parts.shift() === '#', `Only support JSON Schema $refs in format '#/path/to/ref'`)

  let value = lookup
  while (parts.length) {
    value = value[parts.shift()]
    assert.ok(value, `Invalid schema reference: ${ref}`)
  }
  return value
}

function isFunc(f) {
  return !!f && typeof f === 'function'
}

function isObj(o) {
  return !!o && typeof o === 'object'
}
