'use strict';

const path = require('path');
const _ = require('lodash');

/**
 * RouteResolver
 *  Facilitates route registration and unregistration.
 *  Implements Express route middleware based on mockyeah API options.
 */
function RouteResolver(app) {
  this.app = app;
}

function validateResponse(response) {
  const payloadKeysPresent = [];
  const payloadKeys = ['fixture', 'filePath', 'html', 'json', 'text'];

  payloadKeys.forEach(key => {
    if (response[key]) payloadKeysPresent.push(response[key]);
  });

  if (payloadKeysPresent.length > 1) {
    throw new Error('Response options must not include more than one of the following: ' + payloadKeys.join(', '));
  }
}

function handler(response) {
  response = response || {};

  validateResponse(response);

  return (req, res) => {
    const start = (new Date).getTime();
    let send;

    // Default latency to 0 when undefined
    response.latency = response.latency || 0;

    // Default response status to 200 when undefined
    res.status(response.status || 200);

    // set response headers, if received
    if (response.headers) res.set(response.headers);

    if (response.filePath) { // if filePath, send file
      if (response.type) res.type(response.type);
      send = res.sendFile.bind(res, path.resolve(response.filePath));
    } else if (response.fixture) { // if fixture, send fixture file
      if (response.type) res.type(response.type);
      send = res.sendFile.bind(res, path.resolve(this.app.config.fixturesDir, response.fixture));
    } else if (response.html) { // if html, set Content-Type to application/html and send
      res.type(response.type || 'html');
      send = res.send.bind(res, response.html);
    } else if (response.json) { // if json, set Content-Type to application/json and send
      res.type(response.type || 'json');
      send = res.send.bind(res, response.json);
    } else if (response.text) { // if text, set Content-Type to text/plain and send
      res.type(response.type || 'text');
      send = res.send.bind(res, response.text);
    } else if (response.raw) { // if raw, don't set Content-Type
      send = res.send.bind(res, response.raw);
    } else { // else send empty response
      res.type(response.type || 'text');
      send = res.send.bind(res);
    }

    setTimeout(() => {
      const duration = (new Date).getTime() - start;
      send();
      this.app.log(['request', req.method], `${req.url} (${duration}ms)`);
    }, response.latency);
  };
}

RouteResolver.prototype.register = function register(route) {
  if (!_.isFunction(route.response)) {
    route.response = handler.call(this, route.response);
  }

  this.app[route.method](route.path, route.response);
};

RouteResolver.prototype.unregister = function unregister(routes) {
  const routePaths = routes.map((route) => { return route.path; });

  this.app._router.stack = this.app._router.stack.filter((layer) => {
    return !(layer.route && routePaths.indexOf(layer.route.path) >= 0);
  });
};

module.exports = RouteResolver;