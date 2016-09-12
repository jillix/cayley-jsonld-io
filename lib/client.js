// Dependencies
var model = require('./model')
var cayley = require('cayley');

/**
 * Creates a new Client instance
 * @class
 * @return {Client} a Client instance.
 */
var Client = function (options) {

    if (!options) {
        throw new Error('Client requires an options object.');
    }

    if (!options.url) {
        throw new Error('No cayley url provided.')
    }

    this._client = cayley(options.url);
};

/**
 * find
 * Returns jsonld documents based on a query
 *
 * @name find
 * @function
 * @param {Object} query The cayley query that will be used to find the start node.
 * @param {Object} options.
 * @param {Function} callback The callback function.
 */
Client.prototype.find = model.find;

/**
 * insert
 * Inserts jsonld documents
 *
 * @name insert
 * @function
 * @param {Object} document The compacted/expanded jsonld document.
 * @param {Function} callback The callback function.
 */
Client.prototype.insert = model.insert;

/**
 * update
 * Updates a jsonld document
 *
 * @name update
 * @function
 * @param {Object} query The cayley query that will be used to find the start node.
 * @param {Object} document The compacted/expanded jsonld document.
 * @param {Function} callback The callback function.
 */
Client.prototype.update = model.update;

/**
 * remove
 * Removes a jsonld document
 *
 * @name remove
 * @function
 * @param {Object} query The cayley query that will be used to find the start node.
 * @param {Function} callback The callback function.
 */
Client.prototype.remove = model.remove;

module.exports = Client;