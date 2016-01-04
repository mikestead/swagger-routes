'use strict'

const fs = require('fs')
const mkdirp = require('mkdirp')

exports.exists = exists
exports.mkdir = mkdir
exports.readFile = readFile
exports.writeFile = writeFile
exports.renameFile = renameFile
exports.readDir = readDir

function exists(path) {
	return new Promise((res, rej) =>
		fs.lstat(path, (err, stats) =>
			err ? rej(err) : res(stats)))
}

function mkdir(path) {
	return new Promise((res, rej) =>
		mkdirp(path, err =>
			err && err.code !== 'EEXIST' ? rej(err) : res()))
}

function readFile(path) {
	return new Promise((res, rej) =>
		fs.readFile(path, 'utf8', (err, contents) =>
			err ? rej(err) : res(contents)))
}

function writeFile(path, contents) {
	return new Promise((res, rej) =>
		fs.writeFile(path, contents, err =>
			err ? rej(err) : res()))
}

function renameFile(oldPath, newPath) {
	return new Promise((res, rej) =>
		fs.rename(oldPath, newPath, err =>
			err ? rej(err) : res()))
}

function readDir(path) {
	return new Promise((res, rej) =>
		fs.readdir(path, (err, files) =>
			err ? rej(err) : res(files)))
}
