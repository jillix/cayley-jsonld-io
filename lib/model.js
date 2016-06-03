// Dependencies
var jsonld = require('jsonld')
  , utils = require('./utils');

/**
 * Creates a new Model instance
 * @class
 * @return {Model} a Model instance.
 */
var Model = function (client) {
    this._client = client;
};

/**
 * find
 * Returns jsonld documents based on a query
 *
 * @name find
 * @function
 * @param {Object} query The cayley query that will be used to find the start node.
 * @param {Object} projections Nodes that will be used.
 * @param {Function} callback The callback function.
 */
Model.prototype.find = function(query, projections, callback) {

};

/**
 * insert
 * Inserts jsonld documents
 *
 * @name insert
 * @function
 * @param {Object} document The compacted/expanded jsonld document.
 * @param {Function} callback The callback function.
 */
Model.prototype.insert = function(document, callback) {

};

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
Model.prototype.update = function(query, document, callback) {

};

/**
 * remove
 * Removes a jsonld document
 *
 * @name remove
 * @function
 * @param {Object} query The cayley query that will be used to find the start node.
 * @param {Function} callback The callback function.
 */
Model.prototype.remove = function(query, callback) {

};


module.exports = Model;