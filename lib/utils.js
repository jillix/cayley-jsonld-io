// Dependencies
var jsonld = require('jsonld'),
    uuid   = require('uuid'),
    N3Util = require('n3/lib/N3Util');

// Constants required
var RDFTYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    RDFLANGSTRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
    XSDTYPE = 'http://www.w3.org/2001/XMLSchema#';

module.exports = {
    toTriples: toTriples,
    toJsonld: toJsonld,
    getCoercedObject: getCoercedObject,
    expandPredicate: expandPredicate,

    RDFTYPE: RDFTYPE,
    RDFLANGSTRING: RDFLANGSTRING,
    XSDTYPE: XSDTYPE,

    N3Util: N3Util,
    uuid: uuid,
    isURL: isURL
};

/**
 * toTriples
 * converts jsonld document to triples
 *
 * @name toTriples
 * @function
 * @param {Object} doc The compacted/expanded jsonld document(required).
 * @param {Object} options An object containing options:
 * @param {Function} callback The callback function.
 */
function toTriples (doc, options, callback) {

    // convert jsonld to triples
    var blanks = {};
    result = []
    jsonld.toRDF(doc, {}, function (err, triples) {

        if (err || triples.length === 0) {
            return callback(err || new Error('No triples found.'));
        }

        triples['@default'].map(function(triple) {

            var builtTriple = {};

            ['subject', 'predicate', 'object'].forEach(function (key) {
                var nodeValue = triple[key].value;

                // generate UUID to identify blank nodes
                // uses type field set to 'blank node' by jsonld.js toRDF()
                if ((key === 'subject' || key === 'object') && triple[key].type === 'blank node') {
                    if (!blanks[nodeValue]) {
                        blanks[nodeValue] = '_:' + uuid.v1();
                    }
                    nodeValue = blanks[nodeValue];
                }

                // preserve object data types using double quotation for literals
                // and don't keep data type for strings without defined language
                if (key === 'object' && triple.object.datatype) {
                    if (triple.object.datatype.match(XSDTYPE)) {

                        if (triple.object.datatype === 'http://www.w3.org/2001/XMLSchema#string') {
                            nodeValue = '"' + triple.object.value + '"';
                        } else {
                            nodeValue = '"' + triple.object.value + '"^^' + triple.object.datatype;
                        }

                    } else if(triple.object.datatype.match(RDFLANGSTRING)){
                        nodeValue = '"' + triple.object.value + '"@' + triple.object.language;
                    } else {
                        nodeValue = '"' + triple.object.value + '"^^' + triple.object.datatype;
                    }
                }

                builtTriple[key] = nodeValue;

            });

            return builtTriple;
        }).forEach(function (triple) {
            result.push(triple);
        });

        // END
        return callback(null, result);
    });
}

/**
 * toJsonld
 * converts array of triples to expanded jsonld
 *
 * @name toJsonld
 * @function
 * @param {Object} triples The array of tripples.
 * @param {Function} callback The callback function.
 */
function toJsonld (triples, context, callback) {

    if (!triples || !triples.length) {
        return callback(null, []);
    }

    if (!context) {
        return callback(new Error('No context provided.'));
    }

    var result = [];

    // iterate through the triples
    for (var i = 0; i < triples.length; ++i) {
        var triple = triples[i];
        var obj = null;

        result.forEach(function (item) {
            if (item['@id'] === triple.subject) {
                obj = item;
                return;
            }
        });

        if (!obj) {
            obj = { '@id': triple.subject }
            result.push(obj);
        }
        if (triple.predicate === RDFTYPE) {

            // handle @type
            if (obj['@type']) {
                obj['@type'].push(triple.object);
            } else {
                obj['@type'] = [triple.object];
            }

        } else if (!N3Util.isBlank(triple.object)) {

            var object = {};
            if (N3Util.isIRI(triple.object)) {
                object['@id'] = triple.object;
            } else if (N3Util.isLiteral(triple.object)) {
                try {
                    object = getCoercedObject(triple.object);
                } catch (e) {
                    return callback(e);
                }
            }

            if (obj[triple.predicate]) {
                obj[triple.predicate].push(object);
            } else {
                obj[triple.predicate] = [object];
            }
        } else {
            obj[triple.predicate] = triple.object;
        }
    }

    // compact jsonld document
    jsonld.compact(result, context, function (err, compacted) {

        if (err) {
            return callback(null);
        }

        return callback(null, compacted);
    });
};

/**
 * getCoercedObject
 * parse triple value
 *
 * @name getCoercedObject
 * @function
 * @param {String} object the object of a triple.
 */
function getCoercedObject (object) {
    var TYPES = {
        PLAIN: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral',
        BOOLEAN: XSDTYPE + 'boolean',
        INTEGER: XSDTYPE + 'integer',
        DOUBLE: XSDTYPE + 'double',
        STRING: XSDTYPE + 'string',
    };
    var value = N3Util.getLiteralValue(object);
    var type = N3Util.getLiteralType(object);
    var coerced = {};

    switch (type) {
        case TYPES.STRING:
        case TYPES.PLAIN:
            coerced['@value'] = value;
            break;

        case RDFLANGSTRING:
            coerced['@value'] = value;
            coerced['@language'] = N3Util.getLiteralLanguage(object);
            break;

        case TYPES.INTEGER:
            coerced['@value'] = parseInt(value, 10);
            break;

        case TYPES.DOUBLE:
            coerced['@value'] = parseFloat(value);
            break;

        case TYPES.BOOLEAN:
            if (value === 'true' || value === '1') {
                coerced['@value'] = true;
            } else if (value === 'false' || value === '0') {
                coerced['@value'] = false;
            } else {
                throw new Error('value not boolean!');
            }
            break;

        default:
        coerced = { '@value': value, '@type': type };
    }

    return coerced;
}

/**
 * expandPredicate
 * expands predicate based on a context
 *
 * @name expandPredicate
 * @function
 * @param {object} context the jsonld context.
 * @param {String, Array} predicate the object of a triple.
 */
function expandPredicate (context, predicate, callback) {

    if (!predicate || !context) {
        return callback(new Error('Missing context or predicate.'));
    }

    // build a jsonld doc
    var docToExpand = {
        '@context': context
    };
    if (!(predicate instanceof Array)) {
        predicate = [predicate]
    }
    for (var i = 0; i < predicate.length; ++i) {
        if (typeof predicate[i] !== 'string') {
            return callback(new Error('Invalid predicate type.'))
        }
        docToExpand[predicate[i]] = 1;
    }

    jsonld.expand(docToExpand, function (err, expanded) {

        if (err) {
            return callback(err);
        }
        expanded = expanded[0];

        // handle null values
        if (typeof expanded === 'undefined') {
            return callback(null, predicate);
        }

        predicate = Object.keys(expanded);
        return callback(null, predicate);
    });
}

function isURL (str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locater
    if(!pattern.test(str)) {
        return false;
    } else {
        return true;
    }
}