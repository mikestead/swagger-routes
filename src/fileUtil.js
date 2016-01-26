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
exports.disableOldOperationFiles = disableOldOperationFiles
exports.fileInfo = fileInfo

function enableFile(id, data, type, options) {
	const filePath = getFilePath(id, type, options)
	if (!util.existsSync(filePath)) {
		const disabledPath = getDisabledFilePath(id, type, options)
		if (util.existsSync(disabledPath)) {
			return renameFile(disabledPath, filePath, options)
		} else if (options[type].generate) {
			return writeNewHandler(data, type, filePath, options)
		}
	}
	return fileInfo(filePath, false, false, options)
}

function renameFile(oldPath, filePath, options) {
	fs.renameSync(oldPath, filePath)
	return fileInfo(filePath, false, false, options)
}

function writeNewHandler(data, type, filePath, options) {
	const view = options[type].getTemplateView(data)
	const contents = Mustache.render(options[type].template, view)
	util.writeFileSync(filePath, contents)
	return fileInfo(filePath, true, false, options)
}

function disableFile(id, type, options) {
	const filePath = getFilePath(id, type, options)
	const disabledPath = getDisabledFilePath(id, type, options)
	if (util.existsSync(filePath)) {
		fs.renameSync(filePath, disabledPath)
	}
	return fileInfo(disabledPath, false, true, options)
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
	return path.join(options[type].path, `${id}${options.fileType || '.js'}`)
}

function getDisabledFilePath(id, type, options) {
	return path.join(options[type].path, `${options.unusedFilePrefix}${id}${options.fileType || '.js'}`)
}

function fileInfo(filePath, gen, old, options) {
	return {
		id: path.basename(filePath, options.fileType || '.js'),
		path: path.resolve(filePath),
		gen,
		old
	}
}

function disableOldOperationFiles(operations, type, options) {
	if (!options[type].generate || options[type].create) return []

	const fileType = options.fileType || '.js'
	const filenames = fs.readdirSync(options[type].path)
	const unknown = filenames.filter(name =>
			name.endsWith(fileType) &&
			!name.startsWith(options.unusedFilePrefix) &&
			!operations.find(op => `${op.id}${fileType}` === name))

	return unknown.map(name => {
		name = path.basename(name, fileType)
		const filePath = getFilePath(name, type, options)
		const disabledPath = getDisabledFilePath(name, type, options)
		fs.renameSync(filePath, disabledPath)
		return fileInfo(disabledPath, false, true, options)
	})
}
