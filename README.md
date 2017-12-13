# Swagger Routes

[![Build Status](https://travis-ci.org/mikestead/swagger-routes.svg?branch=master)](https://travis-ci.org/mikestead/swagger-routes) [![npm version](https://img.shields.io/npm/v/swagger-routes.svg?style=flat-square)](https://www.npmjs.com/package/swagger-routes)

A tool to generate and register [Restify](http://restify.com) or [Express](http://expressjs.com) route handlers from a 
[Swagger 2.0](http://swagger.io) ([OpenAPI](https://openapis.org)) specification.

### Usage

Requires Node v4.0+

#### Express

```javascript
const swaggerRoutes = require('swagger-routes')
const express = require('express')
const app = express()

swaggerRoutes(app, {
    api: './api.yml',
    handlers:  './src/handlers',
    authorizers: './src/handlers/security'
})
app.listen(8080)
```

#### Restify

```javascript
const swaggerRoutes = require('swagger-routes')
const restify = require('restify')
const server = restify.createServer()

swaggerRoutes(server, {
    api: './api.yml',
    handlers:  './src/handlers',
    authorizers: './src/handlers/security'
})
server.listen(8080)
```

##### Options

- `api`: path to your Swagger spec, or the loaded spec reference.
- `docsPath`: url path to serve your swagger api json. Defaults to `/api-docs`.
- `docsMiddleware`: An optional middleware function that can be used to secure the api docs endpoint.
- `handlers`: directory where your handler files reside. Defaults to `./handlers`. Can alternatively be a function to return a handler function given an operation.
- `authorizers`: directory where your authorizer files reside. Defaults to `./security`. Can alternatively be a function to return an authorizer middleware given a swagger security scheme.
- `maintainHeaders`: Keeps your generated handler doc headers in sync with your Swagger api. Default is false.

### Operation Handlers

You have the option to define and maintain a handler file for each Swagger operation, or alternatively
provide a factory function which creates a handler function given an operation.

#### Handler Files

Using individual handler files is a good choice if each handler needs unique logic to deal with an operation request.

A handler file must be named after the Swagger operation it handles e.g. `listPets.js`.

All handler files must reside in the same directory, unless the `group` option is enabled, 
in which case the handler file should sit under a folder of its primary tag name (see Generating Handler Files below).

##### File Contents

A function called `handler` should be exported to deal with an incoming operation request.

```javascript
exports.handler = function listPets(req, res, next) {

}
```
You also have the option to export a `middleware` function to be executed before the handler.

```javascript
exports.middleware = preprocess

function preprocess(req, res, next) {
    next()
}
```
Middleware can be an ordered list.

```javascript
exports.middleware = [
    function preprocess1(req, res, next) { next() },
    function preprocess2(req, res, next) { next() }
]
```

##### Generating Handler Files

To save you some time there's a bundled tool to generate handler files based on operations in
your Swagger spec, together with a [Mustache](https://mustache.github.io) template.

This tool is on by default so check your handlers folder the first time you run `swaggerRoutes` and
it should be poulated with handler stubs for each operation defined in your Swagger document.

Each time you start your app `swaggerRoutes` will see if you have any missing operation handlers and generate
stub handler for any which are. If a handler file exists it won't be touched, i.e. this is non-destructive so you are free
to edit them.

Note that if you turn on the `syncHeaders` option then the header of your handler files _will_ be 
updated each run based on your Swagger api. This keeps your handler documentation up to date so 
you can easily see what parameters accompany a request for a given operation. It will overwrite
any edits you make to the header so only turn on if you don't plan on manually editing them.

When a re-run finds handlers no longer in use they will be renamed with an `_` prefix, so
`listPets.js` would become `_listPets.js`. This allows you to identify handlers no longer in use
and remove / rename them if you wish.

If you later enable a handler again in your spec and re-run, then the underscore will be removed.

Note that this feature of prefixing removed handlers is only currently supported when the `group`
options is not enabled.

The default template is defined [here](https://github.com/mikestead/swagger-routes/blob/master/template/handler.mustache) but you can supply your own by expanding the `handlers` option e.g.

```javascript
{
    ...
    handlers: {
        path: './src/handlers',
        template: './template/handler.mustache', // can also be set with a loaded template
        getTemplateView: operation => operation, // define the object to be rendered by your template
        create: operation => (req, res) => {}, // see Handler Factory section for details
        generate: true, // hander file generation on by default
        group: false // when true each handler file will be placed under a directory named after its primary tag
    }
}
```

#### Handler Factory

The factory function is a better option to a file if handlers are quite similar e.g. delegate their request
processing onto service classes.

##### Creating a Handler Factory

You can define `handlers` as a function when registering your routes. It receives a Swagger [operation](#operation-object) and returns the request handler responsible for dealing with it.

```javascript
const swaggerRoutes = require('swagger-routes')

swaggerRoutes(app, {
    api: './api.yml',
    handlers:  createHandler
})

function createHandler(operation) {
    return function handler(req, res, next) {
        res.send(operation.id)
    }
}
```

If a handler function is returned then it will take precedence over a handler file for the same operation.

##### Route Middleware

Just as a file handler can define route middleware, so can `createHandler`.

```javascript
function createHandler(operation) {
    return {
        middleware: function preprocess(req, res, next) { next() },
        handler: function handler(req, res, next) { res.send(operation.id) }
    }
}
```

As before, route middleware can be an ordered list.

```javascript
function createHandler(operation) {
    return {
        middleware: [
            function preprocess1(req, res, next) { next() },
            function preprocess2(req, res, next) { next() }
        ],
        handler: function handler(req, res, next) { res.send(operation.id) }
    }
}
```

### Authorizers

When your Swagger api specifies one or more 
[security schemes](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#implicit-oauth2-sample) 
then routes which opt into one or more of these schemes can be protected by authorizer middleware.

Just like handlers, you can define an authorizer in a file or via a factory.

#### File Authorizer

The file should be named after the security scheme it protects e.g. `petstore_auth.js`, and reside in the directory path defined by the `authorizers` option. It should export a single middleware function to authorize a request.

```javascript
module.exports = function petstore_auth(req, res, next) {
    const token = decodeToken(req.headers.authorization)
    if (token) {
        const scopes = getTokenScopes(token)
        next(req.verifyScopes(scopes))
    } else {
        const error = new Error('Unauthorized')
        error.status = error.statusCode = 401
        next(error)
    }
}
```

The above is one example of how this can work.

As you can see a `verifyScopes` function is supplied to the req if the security scheme is OAuth2.
It takes an array of scopes you decode from the authenticated request and verifies that the 
required scope(s) defined be the scheme are present. If they're not a `403 Forbidden` 
[error](https://en.wikipedia.org/wiki/HTTP_403#Difference_from_status_.22401_Unauthorized.22) is returned.

When multiple oauth scopes are defined for the security of an endpoint, Swagger expects all of them to be 
present for a call to proceed. As an extension to this, `swagger-routes` also supports the logical OR of 
token scopes, so if *any* exist then `verifyScopes` succeeds.

As an example, this definition below will pass the auth check if either a `Catalog` OR `Playback` scope exist.

```yaml
  ...
  security:
    - accountAuth:
      - Catalog
      - Playback
  x-security:
    accountAuth:
      OR_scopes: true
```

Remember if no credentials are supplied a `401 Unauthorized` should be returned.

##### Generating Authorizer Files

Much like handler files, authorizer file stubs will be generated and managed for you too.

The default template is defined [here](https://github.com/mikestead/swagger-routes/blob/master/template/authorizer.mustache) 
but you can supply your own by expanding the `authorizers` option e.g.

```javascript
{
    ...
    authorizers: {
    	path: './src/handlers/security',
    	template: './template/authorizer.mustache', // can also be set with a loaded template
    	getTemplateView: operation => operation, // define the object to be rendered by your template
    	create: operation => (req, res) => {}, // see Authorizer Factory section for details
    	generate: true // authorizer file generation on by default
    }
}
```

#### Authorizer Factory

```javascript
const swaggerRoutes = require('swagger-routes')

swaggerRoutes(app, {
    api: './api.yml',
    authorizers: createAuthorizer
})

function createAuthorizer(schemeId, securityScheme) {
    return function authorizer(req, res, next) {
        const token = decodeToken(req.headers.authorization)
        if (token) {
            const scopes = getTokenScopes(token)
            next(req.verifyScopes(scopes))
        } else {
            const error = new Error('Invalid access token')
            error.status = error.statusCode = 401
            next(error)
        }
    }
}
```

### Request Validation

Each incoming request which makes it to a handler will be run through request validation middleware. 
This executes [JSON Schema](http://json-schema.org) validation on the request to ensure it meets 
the Swagger specification you've defined. A failure to meet this requirement will cause the request 
to fail and the handler not to be executed.

### Swagger Host

Statically setting the `host` property of your Swagger api can be error prone if you run the api 
in different environments (QA, Staging, Production), that's why I'd recommended removing its
definition from your specification. This will by default then 
[resolve to the host](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object), including port, the spec 
is served from.

If this still isn't sufficient you have a couple of other options.
 
1. Set `API_HOST` environment variable for your node instance. SwaggerRoutes will pick this up and use it.
1. Set the `app.swagger.host` manually from within your app after you've called `swaggerRoutes`.

```javascript
const server = app.listen(3000, '0.0.0.0', () => {
    app.swagger.host = `${server.address().address}:${server.address().port}`
})
```

## Route Stack Execution Order

1. `authorizer middleware` If there are security restrictions on a route then an authorizer for each will need to verify the rights attached to the request.
1. `custom middleware` If the route defines one or more middleware these will be executed in order.
1. `validation middleware` The incoming request will now be validated against the Swagger spec for the given operation.
1. `handler` Assuming all previous steps pass, the handler is now executed.

## Advanced Usage

### Registering Multiple Swagger Apis

You may be in the situation where you have a Swagger definition for each major version of your api.
If this is the case, and you want to handle each on the same server, then you are free to register
more than one spec.

```javascript
swaggerRoutes(server, {
    api: './api-v1.yml',
    handlers:  './src/handlers/v1',
    authorizers: './src/handlers/v1/security'
})

swaggerRoutes(server, {
    api: './api-v2.yml',
    handlers:  './src/handlers/v2',
    authorizers: './src/handlers/v2/security'
})
```
You'll need to ensure that there's no conflict in route paths between each. The best
way to do that would be to add a unique `basePath` to each spec, say `/v1`, `/v2` etc.

## Operation Object

An operation object inherits its properties from those defined in the [Swagger spec](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#operationObject).

There are only a few differences / additions.

- `id`: Replaces `operationId`.
- `path`: The route path of this operation.
- `method`: The http method
- `consumes`: Populated with the top level `consumes` unless the operation defines its own.
- `produces`: Populated with the top level `produces` unless the operation defines its own.
- `paramGroupSchemas`: JSON Schema for each param group ('header', 'path', 'query', 'body', 'formData') relevant to the operation.

## Acknowledgments

Inspiration for this library came primarily from time spent using [swaggerize-express](https://github.com/krakenjs/swaggerize-express).
It's a great library which you should check out.

My reasoning behind writing a new, alternate implementation was the wish to base all
routing off operation ids and not paths. This aligns with how Swagger client code gen
works, making it easier to see your client SDKs and server code base as a whole.

I also wanted to automate away much of the boilerplate code being written and support
Restify and Express in a single library, given their similarities.
