'use strict'

const path = require('path')
const fs = require('fs')
const Mustache = require('mustache')
const util = require('./util')

exports.enableFile = enableFile
exports.disableFile = disableFile
exports.getTemplate = getTemplate
exports.getFilePath = getFilePath
exports.getDisabledFilePath = getDisabledFilePath
exports.fileInfo = fileInfo

function enableFile(id, data, type, options) {
	const filePath = getFilePath(id, type, options)
	if (!util.existsSync(filePath)) {
		const disabledPath = getDisabledFilePath(id, type, options)
		if (util.existsSync(disabledPath)) {
			return renameFile(disabledPath, filePath)
		} else if (options[type].generate) {
			return writeNewHandler(data, type, filePath, options)
		}
	}
	return fileInfo(filePath, false, false)
}

function renameFile(oldPath, filePath) {
	fs.renameSync(oldPath, filePath)
	return fileInfo(filePath, false, false)
}

function writeNewHandler(data, type, filePath, options) {
	const view = options[type].getTemplateView(data)
	const contents = Mustache.render(options[type].template, view)
	util.writeFileSync(filePath, contents)
	return fileInfo(filePath, true, false)
}

function disableFile(id, type, options) {
	const filePath = getFilePath(id, type, options)
	const disabledPath = getDisabledFilePath(id, type, options)
	if (util.existsSync(filePath)) {
		fs.renameSync(filePath, disabledPath)
	}
	return fileInfo(disabledPath, false, true)
}

function getTemplate(type, options) {
	const template = options[type].template
	if (template && typeof template === 'string') {
		return fs.readFileSync(template, 'utf8')
	} else {
		return template
	}
}

function getFilePath(id, type, options) {
	return path.join(options[type].path, `${id}.js`)
}

function getDisabledFilePath(id, type, options) {
	return path.join(options[type].path, `${options.unusedFilePrefix}${id}.js`)
}

function fileInfo(filePath, gen, old) {
	return {
		id: path.basename(filePath, '.js'),
		path: path.resolve(filePath),
		gen,
		old
	}
}
