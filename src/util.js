'use strict'

const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
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
