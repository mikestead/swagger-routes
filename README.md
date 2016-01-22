# Swagger Routes

[![Build Status](https://travis-ci.org/mikestead/swagger-routes.svg?branch=master)](https://travis-ci.org/mikestead/swagger-routes) [![npm version](https://img.shields.io/npm/v/swagger-routes.svg?style=flat-square)](https://www.npmjs.com/package/swagger-routes)

A tool to generate and register [Restify](http://restify.com) or [Express](http://expressjs.com) route handlers from a 
[Swagger](http://swagger.io) ([OpenAPI](https://openapis.org)) specification.

### Usage

```javascript
import swaggerRoutes from 'swagger-routes'

swaggerRoutes(app, {    // express app or restify server
    api: './api.yml',
    handlers:  './src/handlers',
    authorizers: './src/security'
})
```
##### Options

- `api`: path to your Swagger spec, or the loaded spec reference.
- `docsPath`: url path to serve your swagger api json. Defaults to `/api-docs`.
- `handlers`: directory where your handler files reside. Defaults to `./handlers`. Can alternatively be a function to return a handler function given an operation.
- `authorizers`: directory where your authorizer files reside. Defaults to `./security`. Can alternatively be a function to return an authorizer middleware given a swagger security scheme.

### Operation Handlers

You have the option to define and maintain a handler file for each Swagger operation, or alternatively
provide a factory function which creates a handler function given an operation.

#### Handler Files

Using individual handler files is a good choice if each handler needs unique logic to deal with an operation request.

A handler file must be named after the Swagger operation it handles e.g. `listPets.js`, and all 
handler files must reside in the same directory.

##### File Contents

A function called `handler` should be exported to deal with an incoming operation request.

```javascript
export function handler(req, res) {
   
}
```
You also have the option to export a `middleware` function to be executed before the handler.

```javascript
export const middleware = preprocess

function preprocess(req, res, next) {
    next()
}
```
Middleware can be an ordered list.

```javascript
export const middleware = [
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

When a re-run finds handlers no longer in use they will be renamed with an `_` prefix, so
`listPets.js` would become `_listPets.js`. This allows you to identify handlers no longer in use
and remove / rename them if you wish.

If you later enable a handler again in your spec and re-run, then the underscore will be removed.

The default template is defined [here](https://github.com/mikestead/swagger-routes/blob/master/template/handler.mustache) but you can supply your own by expanding the `handlers` option e.g.

```javascript
{
    ...
    handlers: {
    	path: './src/handlers',
    	template: './template/handler.mustache', // can also be set with a loaded template
    	getTemplateView: operation => operation, // define the object to be rendered by your template
    	create: operation => (req, res) => {}, // see Handler Factory section for details
    	generate: true // hander file generation on by default
    }
}
```

#### Handler Factory

The factory function is a better option to a file if handlers are quite similar e.g. delegate their request
processing onto service classes.

##### Creating a Handler Factory

You can define `handlers` as a function when registering your routes. It receives a Swagger [operation](#operation-object) and returns the request handler responsible for dealing with it.

```javascript
import swaggerRoutes from 'swagger-routes'

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
        handler: function handler(req, res) { res.send(operation.id) }
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
        handler: function handler(req, res) { res.send(operation.id) }
    }
}
```


### Authorizers

When your Swagger api specifies one or more OAuth2 [security schemes](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#implicit-oauth2-sample) then routes which opt into one or more of these schemes can be pretected by an authorizer middleware.

Just like handlers, you can define an authorizer in a file or via a factory.

#### File Authorizer

The file should be named after the security scheme and reside in the directory path defined by the `authorizers` option. It should export a single middleware function to authorize a request.

```javascript
export default function petstore_auth(req, res, next) {
    const token = decodeToken(req.headers.authorization)
    if (!token) {
        const error = new Error('Invalid access token')
        error.status = error.statusCode = 401
        next(error)
    } else {
        const scopes = getTokenScopes(token)
        next(req.verifyScopes(scopes))
    }
}
```

The above is one example of how this can work.

As you can see a `verifyScopes` function is supplied to the req. It takes an array of scopes you decode from the authenticated request and verifies that the required scope(s) are present. If they're not a `403 Forbidden` [error](https://en.wikipedia.org/wiki/HTTP_403#Difference_from_status_.22401_Unauthorized.22) is returned.

Remember if no credentials are supplied a `401 Unauthorized` should be returned.

#### Authorizer Factory

```javascript
import swaggerRoutes from 'swagger-routes'

addRoutes(app, {
    api: './api.yml',
    authorizers: createAuthorizer
})

function createAuthorizer(schemeId, securityScheme) {
    return function authorizer(req, res, next) {
        const token = decodeToken(req.headers.authorization)
        if (!token) {
            const error = new Error('Invalid access token')
            error.status = error.statusCode = 401
            next(error)
        } else {
            const scopes = getTokenScopes(token)
            next(req.verifyScopes(scopes))
        }
    }
}
```

### Route Stack Execution Order

1. authorizer middleware: If there are security restrictions on a route then an authorizer will need to verify the request first.
2. custom middleware: If the route defines one or more middleware these will be executed in order next.
3. validation middleware: The incoming request will now be validated against the Swagger spec for the given operation.
4. handler: Assuming all previous steps pass, the handler is now executed.

### Operation Object

An operation object inherits its properties from those defined in the [Swagger spec](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#operationObject).

There are only a few differences / additions.

- `id`: Replaces `operationId`.
- `path`: The route path of this operation.
- `method`: The http method
- `consumes`: Populated with the top level `consumes` unless the operation defines its own.
- `produces`: Populated with the top level `produces` unless the operation defines its own.
- `paramGroupSchemas`: JSON Schema for each param group ('header', 'path', 'query', 'body', 'formData') relevant to the operation.
