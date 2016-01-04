'use strict'

const path = require('path')
const Mustache = require('mustache')
const util = require('./util')
const swaggerSpec = require('./swaggerSpec')

module.exports = genHandlers

function genHandlers(specPath, outputDir, options) {
	options = applyDefaultOptions(options)
	return swaggerSpec.getSpec(specPath)
		.then(spec => swaggerSpec.getAllOperations(spec))
		.then(operations => genOperationHandlers(operations, outputDir, options))
		.then(files => updateUnusedHandlers(files, outputDir))
}

function applyDefaultOptions(options) {
	return Object.assign({
		templateFile: path.join(__dirname, '..', 'template', 'handler.mustache'),
		getTemplateView: operation => operation
	}, options)
}

function genOperationHandlers(operations, outputDir, options) {
	return util.mkdir(outputDir)
		.then(() => getTemplate(options))
		.then(template =>
			Promise.all(operations.map(opt =>
				writeOptHandler(opt, template, outputDir, options))))
}

function getTemplate(options) {
	return options.template ? options.template : util.readFile(options.templateFile)
}

function writeOptHandler(operation, template, outputDir, options) {
	const filePath = path.join(outputDir, `${operation.id}.js`)
	return util.exists(filePath)
		.then(() => fileInfo(filePath, false, false))
		.catch(() => {
			const oldPath = path.join(outputDir, `_${path.basename(filePath)}`)
			return util.exists(oldPath)
				.then(() => renewOldOptHandler(oldPath, filePath))
				.catch(() => writeNewOptHandler(operation, template, filePath, options))
		})
}

function renewOldOptHandler(oldPath, filePath) {
	return util.renameFile(oldPath, filePath)
		.then(() => fileInfo(filePath, true, false))
}

function writeNewOptHandler(operation, template, filePath, options) {
	const view = options.getTemplateView(operation)
	const contents = Mustache.render(template, view)
	return util.writeFile(filePath, contents)
		.then(() => fileInfo(filePath, true, false))
}

function updateUnusedHandlers(files, outputDir) {
	return util.readDir(outputDir)
		.then(filenames => {
			const unknown = filenames.filter(name => !files.find(f => path.basename(f.path) === name))
			return Promise.all(unknown.map(name => {
				const filePath = path.join(outputDir, name)
				const file = fileInfo(filePath, false, true)
				if (!name.startsWith('_')) {
					const newPath = path.join(outputDir, `_${name}`)
					file.path = newPath
					return util.renameFile(filePath, newPath).then(() => file)
				} else {
					return file
				}
			}))
		})
		.then(unknownFiles => files.concat(unknownFiles))
}

function fileInfo(filePath, gen, old) {
	return {
		id: path.basename(filePath, '.js'),
		path: filePath,
		gen,
		old
	}
}
