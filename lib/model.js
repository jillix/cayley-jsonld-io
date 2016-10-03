// Dependencies
var jsonld = require('jsonld')
  , utils = require('./utils')
  , async = require('async');

// Constants required
var RDFFIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first'
  , RDFREST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'
  , RDFNILL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';

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
exports.find = function (query, context, options, callback) {
    var self = this;

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (!query || !query.length) {
        return callback(new Error('No query provided'));
    }

    if (!context) {
        return callback(new Error('A valid JSON-LD context must be provided.'));
    }

    // init options
    options.projections = options.projections || [];
    options.out = options.out || [];
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
                    return callback(null, null);
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
        _fetchExpandedTriples(g, startNode, options.deep, options.projections, options.out, function (err, expanded) {

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
exports.insert = function (doc, callback) {
    var self = this;

    if (!doc) {
        return callback(new Error('JSON-LD document missing.'));
    }

    if (!doc['@context']) {
        return callback(new Error('JSON-LD document must have a @context.'));
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

                if (!doc['@id']) {
                    doc['@id'] = triples[0].subject;
                }

                return callback(null, doc);
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
exports.update = function (doc, callback) {
    var self = this;

    if (!doc) {
        return callback(new Error('No ducument provided.'));
    }

    // init graph
    var g = self._client.graph;

    // @id must exist
    if (!doc['@id']) {
        return callback(new Error('JSON-LD document must have an @id.'));
    }

    // @context must exist
    if (!doc['@context']) {
        return callback(new Error('JSON-LD document must have a @context.'));   
    }

    // document must exist
    g.V(doc['@id']).All(function (err, result) {

        if (err) {
            return callback(err);
        }
        if (!result) {
            return callback(new Error('Document does not exist.'));
        }

        // convert jsonld document to triples
        utils.toTriples(doc, {}, function (err, newTriples) {

            if (err) {
                return callback(err);
            }

            // convert newTriples to object
            var newObj = {};
            newTriples.forEach(function (triple) {

                if (!newObj[triple.subject]) {
                    newObj[triple.subject] = {};
                }
                newObj[triple.subject][triple.predicate] = triple.object;
            });

            // find old value
            var oldTriples = [];
            async.each(Object.keys(newObj), function (subject, cb) {

                // get triples for current subject
                g.V(subject).Tag('subject').Out(Object.keys(newObj[subject]), 'predicate').Tag('object').All(function (err, result) {

                    if (err) {
                        return cb(err);
                    }
                    result = result || [];

                    oldTriples = oldTriples.concat(result);
                    cb(null);
                });
            }, function (err) {

                if (err) {
                    return callback(err);
                }

                // delete old triples
                self._client.delete(oldTriples, function (err, body, res) {

                    if (err) {
                        return callback(err);
                    }
                    if (!body || body.error) {
                        return callback(new Error((body && body.error) ? body.error : 'Failed to delete old data'));
                    }

                    // write new ones
                    self._client.write(newTriples, function (err, body, res) {

                        if (err) {
                            return callback(err);
                        }
                        if (!body || body.error) {
                            return callback(new Error((body && body.error) ? body.error : 'Failed to delete old data'));
                        }

                        return callback(null, body);
                    });
                });
            });
        });
    });
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
exports.remove = function(query, context, callback) {
    var self = this;

    if (!query || !query.length) {
        return callback(new Error('A valid search query must be provided'));
    }

    if (typeof context === 'function') {
        callback = context;
        context = null;
    }

    var g = self._client.graph;

    // get the start node
    if (query.length > 1) {

        if (!context) {
            return callback(new Error('A valid JSON-LD context is required for more complex queries.'));
        }

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
                    return callback(new Error('Start node not found.'));
                }

                var startNode = [];
                result.forEach(function (value) {
                    startNode.push(value.id);
                });

                // start read
                doRemove(startNode);
            });
        });
    } else {
        doRemove(query[0]);
    }

    function doRemove(startNode) {
        _getAllTriples(g, startNode, true, function (err, triples) {

            if (err) {
                return callback(new Error(err.message));
            }

            self._client.delete(triples, function (err, body, res) {

                if (err) {
                    return callback(err);
                }

                if (!body || body.error) {
                    return callback(new Error((body && body.error) ? body.error : 'Failed to delete data'));
                }

                return callback(null, body);
            });
        });
    }
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

// get all triples from a given start iri
function _getAllTriples (g, iri, deep, done) {

    g.V(iri).Tag('subject').Out(null, 'predicate').Tag('object').All(function (err, triples) {

        if (err) {
            return done(err);
        }

        if (!deep) {
            return done(null, triples);
        }

        async.each(triples, function (triple, cb) {

            if (utils.N3Util.isBlank(triple.object)) {
                _getAllTriples(g, triple.object, deep, function (err, result) {

                    if (err) {
                        return cb(err);
                    }

                    triples = triples.concat(result);
                    cb(null);
                });
            } else {
                cb(null);
            }
        }, function (err) {
            return done(err, triples);
        });
    });
}

function _fetchExpandedTriples (g, iri, deep, projections, out, callback) {

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

            /* handle @list document */
            if (triple.predicate === RDFFIRST || triple.predicate === RDFREST) {
                if (acc[0] && acc[0]['@list']) {
                    obj = acc[0];
                } else {
                    obj = { '@list': [] };
                    acc[0] = obj;
                }
                // step 1. handle first in list
                if (triple.predicate === RDFFIRST) {
                    _fetchExpandedTriples(g, triple.object, true, null, out, function (err, expanded) {
                        if (err) {
                            return cb(err)
                        }
                        if (!expanded || !expanded.length) {
                            return cb(null, acc);
                        }

                        obj['@list'].push(expanded[0]);
                        return cb(null, acc);
                    });
                } else {
                    // step 2. handle rest node
                    if (triple.object !== RDFNILL) {
                        _fetchExpandedTriples(g, triple.object, true, null, out, function (err, expanded) {

                            if (err) {
                                return cb(err)
                            }
                            if (!expanded || !expanded.length) {
                                return cb(null, acc);
                            }
                            if (!expanded[0]['@list']) {
                                return cb(null, acc);
                            }

                            obj['@list'] = obj['@list'].concat(expanded[0]['@list']);
                            return cb(null, acc);
                        });
                    } else {
                        return cb(null, acc);
                    }
                }
            } else {

                /* handle @id document */
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
                // handle @type
                if (triple.predicate === utils.RDFTYPE) {

                    // handle @type
                    if (obj['@type']) {
                        obj['@type'].push(triple.object);
                    } else {
                        obj['@type'] = [triple.object];
                    }

                    // continiue to next triple
                    cb (null, acc);

                // handle values
                } else if (!utils.N3Util.isBlank(triple.object) && out.indexOf(triple.predicate) < 0) {

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
                // handle blank nodes
                } else if ((utils.N3Util.isBlank(triple.object) || out.indexOf(triple.predicate) >= 0) && deep) {
                    _fetchExpandedTriples(g, triple.object, true, null, out, function (err, expanded) {

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
    if (!utils.N3Util.isBlank(startNode) && !utils.isURL(startNode)){
        startNode = utils.N3Util.createLiteral(startNode);
    }

    // init the path
    var path = g.V(startNode);

    // remove the start node
    query.splice(0, 1);

    // build path
    async.each(query, function (el, cb) {

        if (el[0] === 'In') {
            if (typeof el[1] !== 'string' && !(el[1] instanceof Array)) {
                return cb(new Error('Invalid "In" query.'));
            }

            // bypass expansion
            if (el[2]) {
                path = path.In(el[1]);
                return cb(null);
            }

            // expand predicate
            utils.expandPredicate(context, el[1], function (err, predicate) {

                if (err) {
                    return cb(new Error('Invalid "In" query.'));
                }

                path = path.In(predicate);
                cb(null);
            });
        } else if (el[0] === 'Has') {

            if (!el[1] || !(el[1] instanceof Array) || !el[1].length) {
                return cb(new Error('Invalid "Has" query.'));
            }
            if (typeof el[1][0] !== 'string') {
                return cb(new Error('Invalid "Has" query.'));
            }

            // create value to search
            var value = el[1][1];
            if (typeof value !== 'string' || (!utils.N3Util.isBlank(value) && !utils.isURL(value))){
                value = utils.N3Util.createLiteral(value);
            }

            // bypass expansion
            if (el[2]) {
                path = path.Has(el[1][0], value);
                return cb(null);
            }

            // expand predicate
            utils.expandPredicate(context, el[1][0], function (err, predicate) {

                if (err) {
                    return cb(err);
                }

                path = path.Has(predicate, value);
                cb(null);
            });
        } else if (el[0] === 'Is') {

            if (!el[1]) {
                return cb(new Error('Invalid "Is" query.'));
            }

            // create value to search
            var value = el[1][1];
            if (typeof value !== 'string' || (!utils.N3Util.isBlank(value) && !utils.isURL(value))){
                value = utils.N3Util.createLiteral(value);
            }

            path = path.Is(value);
            cb(null);
        } else if (el[0] === 'Out') {

            if (typeof el[1] !== 'string' && !(el[1] instanceof Array)) {
                return cb(new Error('Invalid "Out" query.'));
            }

            // bypass expansion
            if (el[2]) {
                path = path.Out(el[1]);
                return cb(null);
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