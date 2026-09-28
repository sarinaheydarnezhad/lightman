const { Server } = require('node:http');

// Expo serves its HTML before Metro's enhanceMiddleware runs. Apply these
// headers at the HTTP server boundary so the document and worker are isolated.
const emit = Server.prototype.emit;
Server.prototype.emit = function (event, ...args) {
  if (event === 'request') {
    const response = args[1];
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  return emit.call(this, event, ...args);
};
