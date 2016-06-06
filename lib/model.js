// Dependencies
var jsonld = require('jsonld')
  , utils = require('./utils')
  , async = require('async');

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
 * @param {Object} options.
 * @param {Function} callback The callback function.
 */
Model.prototype.find = function(query, context, options, callback) {
    var self = this;

    if (!query || !query.length) {
        return callback(new Error('No query provided'));
    }

    if (!context) {
        return callback(new Error('A valid JSON-LD context must be provided.'));
    }

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    // init options
    options.projections = options.projections || null;
    options.deep = options.deep || true;

    // get graph
    var g = self._client.graph;

    // check if a query is required
    if (query.length > 1) {
        _buildQueryPath(g, context, query, function (err, path) {

            if (err) {
                return callback(err);
            }

            // execute query
            path.All(function (err, result) {

                if (err) {
                    return callback(err);
                }
                if (!result || !result.length) {
                    return callback(null, {
                        result: null
                    });
                }

                var startNode = [];
                result.forEach(function (value) {
                    startNode.push(value.id);
                });

                // start read
                doRead(startNode);
            });
        });
    } else {
        doRead(query[0]);
    }

    function doRead (startNode) {

        // fetch all extended triples
        _fetchExpandedTriples(g, startNode, options.deep, options.projections, function (err, expanded) {

            if (err) {
                return callback(err);
            }
            if (!expanded) {
                return callback(null, null);
            }

            // compact expanded document
            jsonld.compact(expanded, context, function (err, compacted) {

                if (err) {
                    return callback(err);
                }

                return callback(null, compacted);
            });
        });
    }
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
Model.prototype.insert = function(doc, callback) {
    var self = this;

    if (!doc) {
        return callback(new Error('JSON-LD document missing.'));
    }

    // get graph
    var g = self._client.graph;

    // convert jsonld document to triples
    utils.toTriples(doc, {}, function (err, triples) {

        if (err) {
            return callback(new Error(err.message));
        }
        if (!triples.length) {
            return callback(new Error('Document empty after conversion to triples'));
        }

        // subjects must not already exist
        var subjects = [];
        for (var i = 0; i < triples.length; ++i) {
            if (subjects.indexOf(triples[i].subject) < 0) {
                subjects.push(triples[i].subject);
            }
        }
        _checkIfNodesExist.call(self, subjects, function (err) {

            if (err) {
                return callback(new Error(err.message));
            }

            // insert triples
            self._client.write(triples, function (err, body, res) {

                if (err) {
                    return callback(new Error(err.message));
                }

                if (!body || body.error) {
                    return callback(new Error((body && body.error) ? body.error : 'Failed to write data'));
                }

                utils.toJsonld(triples, doc['@context'], function (err, result) {

                    if (err) {
                        return callback(new Error(err.message));
                    }

                    return callback(null, result);
                });
            });
        });
    });
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

    return callback(new Error('Not implemented yet'));
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

    return callback(new Error('Not implemented yet'));
};

/* Private functions */

// check if nodes exist
function _checkIfNodesExist (nodes, callback) {
    var g = this._client.graph;

    if (typeof nodes !== 'string' && !(nodes instanceof Array)) {
        return callback(new Error('Nodes must be arrays or string'));
    }

    g.V(nodes).All(function(err, result) {

        if (err) {
            return callback(err);
        }

        if (!result) {
            return callback(null);
        }

        // TODO also specify what nodes already exist
        return callback(new Error('Some nodes already exist'));
    });
}

function _fetchExpandedTriples (g, iri, deep, projections, callback) {

    // fetch triples from start iri
    g.V(iri).Tag('subject').Out(projections, 'predicate').Tag('object').All(function (err, triples) {

        if (err) {
            return callback(err);
        }
        if (!triples) {
            return callback(null, null);
        }

        mem = [];
        async.reduce(triples, mem, function (acc, triple, cb) {
            var obj = null;

            acc.forEach(function (item) {
                if (item['@id'] === triple.subject) {
                    obj = item;
                    return;
                }
            });

            if (!obj) {
                obj = { '@id': triple.subject }
                acc.push(obj);
            }
            if (triple.predicate === utils.RDFTYPE) {

                // handle @type
                if (obj['@type']) {
                    obj['@type'].push(triple.object);
                } else {
                    obj['@type'] = [triple.object];
                }

                // continiue to next triple
                cb (null, acc);
            } else if (!utils.N3Util.isBlank(triple.object)) {

                var object = {};
                if (utils.N3Util.isIRI(triple.object)) {
                    object['@id'] = triple.object;
                } else if (utils.N3Util.isLiteral(triple.object)) {
                    try {
                        object = utils.getCoercedObject(triple.object);
                    } catch (e) {
                        return cb(e);
                    }
                }

                if (obj[triple.predicate]) {
                    obj[triple.predicate].push(object);
                } else {
                    obj[triple.predicate] = [object];
                }

                // continue to next triple
                cb (null, acc);
            } else if (utils.N3Util.isBlank(triple.object) && deep) {
                _fetchExpandedTriples(g, triple.object, true, null, function (err, expanded) {

                    if (expanded !== null && !obj[triple.predicate]) {
                        obj[triple.predicate] = expanded;
                    } else if (expanded !== null) {

                        if (!obj[triple.predicate].push) {
                            obj[triple.predicate] = [obj[triple.predicate]];
                        }
                        obj[triple.predicate] = obj[triple.predicate].concat(expanded);
                    }

                    // continue to next triple
                    cb(err, acc);
                });
            } else {
                obj[triple.predicate] = triple.object;

                // continue to next triple
                cb(err, acc);
            }
        }, callback);
    });
}

function _buildQueryPath (g, context, query, callback) {

    // build the start node
    if (typeof query[0] !== 'string') {
        return callback(new Error('Query start node must be a string.'));
    }
    var startNode = query[0];

    if (!utils.N3Util.isBlank(startNode)){
        startNode = utils.N3Util.createLiteral(startNode);
    }

    // init the path
    var path = g.V(startNode);

    // remove the start node
    query.splice(0, 1);

    // build path
    async.each(query, function (el, cb) {

        if (el[0] === 'In') {

            if (typeof el[1] !== 'string') {
                return cb(new Error('Invalid "In" query.'));
            }

            // expand predicate
            utils.expandPredicate(context, el[1], function (err, predicate) {

                if (err) {
                    return cb(err);
                }

                path = path.In(predicate);
                cb(null);
            });
        } else if (el[0] === 'Has') {

            if (!el[1] || !(el[1] instanceof Array) || !el[1].length) {
                return cb(new Error('Invalid "Has" query.'))
            }
            if (typeof el[1][0] !== 'string') {
                return cb(new Error('Invalid "Has" query.'))
            }

            // expand predicate
            utils.expandPredicate(context, el[1][0], function (err, predicate) {

                if (err) {
                    return cb(err);
                }

                path = path.Has(predicate, utils.N3Util.createLiteral(el[1][1]));
                cb(null);
            });
        } else if (el[0] === 'Is') {

            if (!el[1]) {
                return cb(new Error('Invalid "Is" query.'));
            }

            path = path.Is(utils.N3Util.createLiteral(el[1]));
            cb(null);
        } else if (el[0] === 'Out') {

            if (typeof el[1] !== 'string') {
                return cb(new Error('Invalid "Out" query.'));
            }

            // expand predicate
            utils.expandPredicate(context, el[1], function (err, predicate) {

                if (err) {
                    return cb(err);
                }

                path = path.Out(predicate);
                cb(null);
            });
        } else {
            return cb(new Error('Query contains invalid path: ' + el[0]));
        }
    }, function (err) {

        if (err) {
            return callback(err);
        }

        return callback(null, path);
    });
}

module.exports = Model;