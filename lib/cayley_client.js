// Dependencies
var Model = require('./model')
var cayley = require('cayley');

/**
 * Creates a new CayleyClient instance
 * @class
 * @return {CayleyClient} a CayleyClient instance.
 */
var CayleyClient = function () {};

/**
 * Connect to Cayley DB using a url
 *
 * @method
 * @static
 * @param {string} url The connection URI string
 * @param {object} [options=null] Optional settings. Options will be passed to request, so you can add settings like proxy, headers.
 * @param {function} [callback] The command result callback
 */
CayleyClient.prototype.connect = function (url, options, callback) {

    if (typeof options === 'function' && typeof callback === 'undefined') {
        callback = options;
        options = {};
    }
    callback = (typeof callback !== 'function') ? function () {} : callback;

    if (!url) {
        return callback(new Error('Missing connection url string.'));
    }

    var client = cayley(url, options);

    var model = new Model(client);
    return callback(null, model);
};

module.exports = CayleyClient;