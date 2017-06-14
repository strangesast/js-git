var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
System.register("mixins/repo", [], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("lib/modes", [], function (exports_2, context_2) {
    "use strict";
    var __moduleName = context_2 && context_2.id;
    function isBlob(mode) {
        return (mode & masks.blob) === masks.mask;
    }
    function isFile(mode) {
        return (mode & masks.file) === masks.mask;
    }
    function toType(mode) {
        if (mode === modes.commit)
            return "commit";
        if (mode === modes.tree)
            return "tree";
        if ((mode & masks.blob) === masks.mask)
            return "blob";
        return "unknown";
    }
    var masks, modes;
    return {
        setters: [],
        execute: function () {
            masks = {
                mask: parseInt('100000', 8),
                blob: parseInt('140000', 8),
                file: parseInt('160000', 8)
            };
            exports_2("modes", modes = {
                isBlob,
                isFile,
                toType,
                tree: parseInt('40000', 8),
                blob: parseInt('100644', 8),
                file: parseInt('100644', 8),
                exec: parseInt('100755', 8),
                sym: parseInt('120000', 8),
                commit: parseInt('160000', 8)
            });
        }
    };
});
System.register("lib/object-codec", ["lib/modes"], function (exports_3, context_3) {
    "use strict";
    var __moduleName = context_3 && context_3.id;
    function frame({ type, body }) {
        let encoder = encoders[type];
        body = encoder(body);
        let header = new TextEncoder().encode(`${type} ${body.length}\0`);
        let result = new Uint8Array(header.length + body.length);
        result.set(header);
        result.set(body, header.length);
        return result;
    }
    exports_3("frame", frame);
    function deframe(buffer, decode = true) {
        var space = buffer.indexOf(0x20);
        if (space < 0)
            throw new Error('Invalid git object buffer');
        var nil = buffer.indexOf(0x00, space);
        if (nil < 0)
            throw new Error('Invalid git object buffer');
        var body = buffer.slice(nil + 1);
        var size = parseDec(buffer, space + 1, nil);
        if (size !== body.length)
            throw new Error('Invalid body length.');
        var type = new TextDecoder().decode(buffer.slice(0, space));
        return {
            type,
            body: decode ? decoders[type](body) : body
        };
    }
    exports_3("deframe", deframe);
    function validateBody(body) {
        if (typeof body === 'string' || body instanceof Uint8Array) {
            return;
        }
        throw new Error('invalid body type');
    }
    exports_3("validateBody", validateBody);
    function encodeBlob(body) {
        if (!(typeof body === 'string' || body instanceof Uint8Array)) {
            throw new Error('blobs must be binary values');
        }
        return body;
    }
    function treeMap(key) {
        let entry = this[key];
        let { mode, hash } = entry;
        return { name: key, mode, hash };
    }
    exports_3("treeMap", treeMap);
    function treeSort(a, b) {
        let aa = (a.mode === modes_1.modes.tree) ? a.name + '/' : a.name;
        let bb = (b.mode === modes_1.modes.tree) ? b.name + '/' : b.name;
        return aa > bb ? 1 : aa < bb ? -1 : 0;
    }
    function encodeTree(body) {
        if (Array.isArray(body)) {
            throw new TypeError('Tree must be in object form');
        }
        let list = Object.keys(body).map(treeMap, body).sort(treeSort);
        let tree = list.map(({ mode, name, hash }) => `${mode.toString(8)} ${name}\0${hash}`).join('');
        return new TextEncoder().encode(tree);
    }
    function safe(string) {
        return string.replace(/(?:^[\.,:;<>'']+|[\0\n<>]+|[\.,:;<>'']+$)/gm, '');
    }
    function two(num) {
        return ('0' + num).slice(-2);
    }
    function formatDate(date) {
        var seconds, offset;
        if (date.seconds) {
            seconds = date.seconds;
            offset = date.offset;
        }
        else {
            seconds = Math.floor(date.getTime() / 1000);
            offset = date.getTimezoneOffset();
        }
        var neg = '+';
        if (offset <= 0) {
            offset = -offset;
        }
        else {
            neg = '-';
        }
        offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
        return seconds + ' ' + offset;
    }
    function formatPerson(person) {
        let { name, email, date } = person;
        if (typeof name !== 'string') {
            throw new TypeError('invalid name in person');
        }
        if (typeof email !== 'string') {
            throw new TypeError('invalid email in person');
        }
        if (!date) {
            throw new TypeError('invalid date in person');
        }
        return `${safe(person.name)} <${safe(person.email)}> ${formatDate(person.date)}`;
    }
    function encodeCommit(body) {
        let { tree, parents, author, committer, message } = body;
        parents = parents || [];
        var str = 'tree ' + tree;
        if (!Array.isArray(parents)) {
            throw TypeError('invalid parents type');
        }
        for (let p of parents) {
            str += '\nparent ' + p;
        }
        str += '\nauthor ' + formatPerson(body.author) + '\ncommitter ' + formatPerson(body.committer) + '\n\n' + body.message;
        return new TextEncoder().encode(str);
    }
    function encodeTag({ object, type, tag, tagger, message }) {
        var str = `object ${object}\ntype ${type}\ntag ${tag}\ntagger ${formatPerson(tagger)}\n\n${message}`;
        return new TextEncoder().encode(str);
    }
    function decodeBlob(body) {
        return body;
    }
    function decodeTree(body) {
        var i = 0;
        var length = body.length;
        var start;
        var mode;
        var name;
        var hash;
        var tree = {};
        let decoder = new TextDecoder();
        while (i < length) {
            start = i;
            i = body.indexOf(0x20, start);
            if (i < 0)
                throw new SyntaxError('Missing space');
            mode = parseOct(body, start, i++);
            start = i;
            i = body.indexOf(0x00, start);
            name = decoder.decode(body.slice(start, i++));
            hash = body.slice(i, i += 20).map(i => ('0' + i.toString(16)).slice(-2)).join('');
            tree[name] = { mode, hash };
        }
        return tree;
    }
    function decodeCommit(body) {
        let i = 0, start, key, parents = [], commit = {
            tree: '',
            parents: parents,
            author: '',
            committer: '',
            message: ''
        }, decoder = new TextDecoder();
        while (body[i] !== 0x0a) {
            start = i;
            i = body.indexOf(0x20, start);
            if (i < 0)
                throw new SyntaxError('Missing space');
            key = decoder.decode(body.slice(start, i++));
            start = i;
            i = body.indexOf(0x0a, start);
            if (i < 0)
                throw new SyntaxError('Missing linefeed');
            let value = decoder.decode(body.slice(start, i++));
            if (key === 'parent') {
                parents.push(value);
            }
            else {
                if (key === 'author' || key === 'committer') {
                    value = decodePerson(value);
                }
                commit[key] = value;
            }
        }
        i++;
        commit.message = decoder.decode(body.slice(i, body.length));
        return commit;
    }
    function decodeTag(body) {
        var i = 0;
        var start;
        var key;
        var tag = { message: null };
        let decoder = new TextDecoder();
        while (body[i] !== 0x0a) {
            start = i;
            i = body.indexOf(0x20, start);
            if (i < 0)
                throw new SyntaxError('Missing space');
            key = decoder.decode(body.slice(start, i++));
            start = i;
            i = body.indexOf(0x0a, start);
            if (i < 0)
                throw new SyntaxError('Missing linefeed');
            let value = decoder.decode(body.slice(start, i++));
            if (key === 'tagger')
                value = decodePerson(value);
            tag[key] = value;
        }
        i++;
        tag.message = decoder.decode(body);
        return tag;
    }
    function decodePerson(string) {
        var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
        if (!match)
            throw new Error('Improperly formatted person string');
        return {
            name: match[1],
            email: match[2],
            date: {
                seconds: parseInt(match[3], 10),
                offset: parseInt(match[4], 10) / 100 * -60
            }
        };
    }
    function parseOct(buffer, start, end) {
        var val = 0;
        while (start < end) {
            val = (val << 3) + buffer[start++] - 0x30;
        }
        return val;
    }
    function parseDec(buffer, start, end) {
        var val = 0;
        while (start < end) {
            val = val * 10 + buffer[start++] - 0x30;
        }
        return val;
    }
    var modes_1, encoders, decoders;
    return {
        setters: [
            function (modes_1_1) {
                modes_1 = modes_1_1;
            }
        ],
        execute: function () {
            exports_3("encoders", encoders = {
                blob: encodeBlob,
                tree: encodeTree,
                commit: encodeCommit,
                tag: encodeTag
            });
            exports_3("decoders", decoders = {
                blob: decodeBlob,
                tree: decodeTree,
                commit: decodeCommit,
                tag: decodeTag
            });
        }
    };
});
System.register("mixins/indexeddb", ["lib/object-codec", "js-sha1"], function (exports_4, context_4) {
    "use strict";
    var __moduleName = context_4 && context_4.id;
    function encodeBody(type, body) {
        let encodedBody = body;
        if (type === 'blob') {
            if (typeof encodedBody !== 'string') {
                encodedBody = JSON.stringify(encodedBody);
            }
            if (!(encodedBody instanceof Uint8Array)) {
                encodedBody = new TextEncoder().encode(encodedBody);
            }
        }
        return encodedBody;
    }
    function comparer(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    }
    var object_codec_1, sha1, IndexedDB;
    return {
        setters: [
            function (object_codec_1_1) {
                object_codec_1 = object_codec_1_1;
            },
            function (sha1_1) {
                sha1 = sha1_1;
            }
        ],
        execute: function () {
            IndexedDB = class IndexedDB {
                constructor(refPrefix) {
                    this.refPrefix = refPrefix;
                }
                init(name, version, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.db = (yield new Promise((resolve, reject) => {
                            let request = indexedDB.open(name, version);
                            request.onupgradeneeded = (evt) => {
                                let db = request.result;
                                evt.target.transaction.onerror = (evt) => {
                                    reject(evt.target.error);
                                };
                                let storeNames = [].slice.call(db.objectStoreNames);
                                if (storeNames.indexOf('objects') > -1) {
                                    db.deleteObjectStore('objects');
                                }
                                if (storeNames.indexOf('refs') > -1) {
                                    db.deleteObjectStore('refs');
                                }
                                let objectsObjectStore = db.createObjectStore('objects', { keyPath: 'hash' });
                                let keysObjectStore = db.createObjectStore('refs', { keyPath: 'path' });
                                resolve(db);
                            };
                            request.onsuccess = (evt) => resolve(request.result);
                            request.onerror = (evt) => reject(evt.target.error);
                        }));
                        if (callback)
                            callback(this.db);
                    });
                }
                reset(callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (!this.db) {
                            throw new Error('not initialized');
                        }
                        let transaction = this.db.transaction(['objects', 'refs'], 'readwrite');
                        let complete = new Promise((r) => transaction.oncomplete = () => r());
                        transaction.objectStore('objects').clear();
                        transaction.objectStore('refs').clear();
                        yield complete;
                        if (callback)
                            callback();
                        return;
                    });
                }
                saveAs(type, body, callback, forcedHash) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['objects'], 'readwrite');
                        let encodedBody = encodeBody(type, body);
                        let buffer = object_codec_1.frame({ type, body: encodedBody });
                        let hash = forcedHash || sha1(buffer);
                        let request = transaction.objectStore('objects').put({ hash, type, body });
                        yield new Promise((r) => request.onsuccess = () => r(request.result));
                        if (callback)
                            callback(hash);
                        return hash;
                    });
                }
                saveMany(objects, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['objects'], 'readwrite');
                        let store = transaction.objectStore('objects');
                        let items = objects.map(({ type, body }) => {
                            let encodedBody = encodeBody(type, body);
                            let buffer = object_codec_1.frame({ type, body: encodedBody });
                            let hash = sha1(buffer);
                            return { type, hash, body };
                        });
                        let result = (yield new Promise((resolve, reject) => {
                            let i = 0;
                            next();
                            function next() {
                                if (i < items.length) {
                                    store.put(items[i++]).onsuccess = next;
                                }
                                else {
                                    resolve(items.map(({ hash }) => hash));
                                }
                            }
                        }));
                        return result;
                    });
                }
                loadAs(type, hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['objects']);
                        let request = transaction.objectStore('objects').get(hash);
                        let result = (yield new Promise((r) => request.onsuccess = () => r(request.result)));
                        if (result.type === type) {
                            if (callback)
                                callback(result.body);
                            return result.body;
                        }
                        throw new TypeError('invalid type requested');
                    });
                }
                loadRaw(hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['objects']);
                        let request = transaction.objectStore('objects').get(hash);
                        let result = yield new Promise((r) => request.onsuccess = () => r(request.result));
                        if (callback)
                            callback(result);
                        return result;
                    });
                }
                loadMany(hashes, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['objects']);
                        hashes.sort(comparer);
                        let result = yield new Promise((resolve, reject) => {
                            let i = 0;
                            let request = transaction.objectStore('objects').openCursor();
                            let result = [];
                            request.onsuccess = (e) => {
                                let cursor = request.result;
                                if (!cursor)
                                    return resolve(result);
                                let key = cursor.key;
                                while (key > hashes[i]) {
                                    ++i;
                                    if (i === hashes.length) {
                                        return resolve(result);
                                    }
                                }
                                if (key === hashes[i]) {
                                    result.push(cursor.value);
                                    cursor.continue();
                                }
                                else {
                                    cursor.continue(hashes[i]);
                                }
                            };
                            request.onerror = (e) => reject(e);
                        });
                        if (callback)
                            callback(result);
                        return result;
                    });
                }
                readRef(ref, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let path = this.refPrefix + '/' + ref;
                        let transaction = this.db.transaction(['refs']);
                        let request = transaction.objectStore('refs').get(path);
                        let result = (yield new Promise((r) => request.onsuccess = () => r(request.result)));
                        if (callback)
                            callback(result);
                        return result;
                    });
                }
                updateRef(ref, hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let path = this.refPrefix + '/' + ref;
                        let transaction = this.db.transaction(['refs'], 'readwrite');
                        let request = transaction.objectStore('refs').put({ path, hash });
                        let result = (yield new Promise((r) => request.onsuccess = () => r(request.result)));
                        if (callback)
                            callback();
                        return;
                    });
                }
                listRefs(prefix = this.refPrefix, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let transaction = this.db.transaction(['refs']);
                        let request = transaction.objectStore('refs').getAll();
                        let result = (yield new Promise((r) => request.onsuccess = () => r(request.result)));
                        if (callback)
                            callback();
                        return result;
                    });
                }
            };
            exports_4("IndexedDB", IndexedDB);
        }
    };
});
System.register("lib/util", [], function (exports_5, context_5) {
    "use strict";
    var __moduleName = context_5 && context_5.id;
    function applyMixins(derivedCtor, baseCtors) {
        baseCtors.forEach(baseCtor => {
            Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
                derivedCtor.prototype[name] = baseCtor.prototype[name];
            });
        });
    }
    exports_5("applyMixins", applyMixins);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("mixins/memdb", ["lib/object-codec", "js-sha1"], function (exports_6, context_6) {
    "use strict";
    var __moduleName = context_6 && context_6.id;
    var object_codec_2, sha1, MemDB;
    return {
        setters: [
            function (object_codec_2_1) {
                object_codec_2 = object_codec_2_1;
            },
            function (sha1_2) {
                sha1 = sha1_2;
            }
        ],
        execute: function () {
            MemDB = class MemDB {
                constructor(refPrefix) {
                    this.refPrefix = refPrefix;
                    this.objects = {};
                    this.refs = {};
                }
                saveAs(type, body, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let buffer = object_codec_2.frame({ type, body });
                        let hash = sha1(buffer);
                        this.objects[hash] = buffer;
                        if (callback)
                            callback(null, hash);
                        return hash;
                    });
                }
                saveRaw(hash, buffer, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.objects[hash] = buffer;
                        if (callback)
                            callback(null);
                        return;
                    });
                }
                saveMany(objects, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let hashes = [];
                        for (let { type, body } of objects) {
                            hashes.push(yield this.saveAs(type, body));
                        }
                        return hashes;
                    });
                }
                loadAs(type, hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let buffer = this.objects[hash];
                        if (!buffer) {
                            return null;
                        }
                        let { type: t, body } = object_codec_2.deframe(buffer);
                        if (t !== type) {
                            throw new TypeError('type mismatch');
                        }
                        if (callback)
                            callback(null, body);
                        return body;
                    });
                }
                loadRaw(hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let buffer = this.objects[hash];
                        if (callback)
                            callback(null, buffer);
                        return buffer;
                    });
                }
                loadMany(hashes, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let result = [];
                        for (let hash in this.objects) {
                            if (hashes.indexOf(hash) > -1) {
                                result.push(object_codec_2.deframe(this.objects[hash]));
                            }
                        }
                        return result;
                    });
                }
                readRef(ref, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let hash = this.refs[this.refPrefix + '/' + ref];
                        if (callback)
                            callback(null, hash);
                        return hash;
                    });
                }
                updateRef(ref, hash, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        this.refs[ref] = hash;
                        if (callback)
                            callback(null);
                        return;
                    });
                }
                listRefs(prefix = this.refPrefix, callback) {
                    return __awaiter(this, void 0, void 0, function* () {
                        let refs = Object.keys(this.refs);
                        if (prefix) {
                            refs = refs.filter(ref => ref.startsWith(prefix + '/'));
                        }
                        if (callback)
                            callback(null, refs);
                        return refs;
                    });
                }
            };
            exports_6("MemDB", MemDB);
        }
    };
});
System.register("mixins/formats", ["lib/object-codec"], function (exports_7, context_7) {
    "use strict";
    var __moduleName = context_7 && context_7.id;
    function Formats(Base) {
        return class extends Base {
            saveAs(type, body, callback, forcedHash) {
                const _super = name => super[name];
                return __awaiter(this, void 0, void 0, function* () {
                    type = type === 'text' ? 'blob' :
                        type === 'array' ? 'tree' : type;
                    if (type === 'tree') {
                        body = normalizeTree(body);
                    }
                    else if (type === 'commit') {
                        body = normalizeCommit(body);
                    }
                    else if (type === 'tag') {
                        body = normalizeTag(body);
                    }
                    return _super("saveAs").call(this, type, body, callback, forcedHash);
                });
            }
            loadAs(type, hash, callback) {
                const _super = name => super[name];
                return __awaiter(this, void 0, void 0, function* () {
                    var realType = type === 'text' ? 'blob' :
                        type === 'array' ? 'tree' : type;
                    let body = yield _super("loadAs").call(this, realType, hash);
                    if (type === 'text') {
                        body = new TextDecoder().decode(body);
                    }
                    if (type === 'array') {
                        body = toArray(body);
                    }
                    if (callback)
                        callback(null, body);
                    return body;
                });
            }
        };
    }
    exports_7("Formats", Formats);
    function toArray(tree) {
        return Object.keys(tree).map(object_codec_3.treeMap, tree);
    }
    function normalizeTree(body) {
        var type = body && typeof body;
        if (type !== 'object') {
            throw new TypeError('Tree body must be array or object');
        }
        var tree = {}, i, l, entry;
        // If array form is passed in, convert to object form.
        if (Array.isArray(body)) {
            for (i = 0, l = body.length; i < l; i++) {
                entry = body[i];
                tree[entry.name] = {
                    mode: entry.mode,
                    hash: entry.hash
                };
            }
        }
        else {
            var names = Object.keys(body);
            for (i = 0, l = names.length; i < l; i++) {
                var name = names[i];
                entry = body[name];
                tree[name] = {
                    mode: entry.mode,
                    hash: entry.hash
                };
            }
        }
        return tree;
    }
    function normalizeCommit(body) {
        if (!body || typeof body !== 'object') {
            throw new TypeError('Commit body must be an object');
        }
        if (!(body.tree && body.author && body.message)) {
            throw new TypeError('Tree, author, and message are required for commits');
        }
        var parents = body.parents || (body.parent ? [body.parent] : []);
        if (!Array.isArray(parents)) {
            throw new TypeError('Parents must be an array');
        }
        var author = normalizePerson(body.author);
        var committer = body.committer ? normalizePerson(body.committer) : author;
        return {
            tree: body.tree,
            parents: parents,
            author: author,
            committer: committer,
            message: body.message
        };
    }
    function normalizeTag(body) {
        if (!body || typeof body !== 'object') {
            throw new TypeError('Tag body must be an object');
        }
        if (!(body.object && body.type && body.tag && body.tagger && body.message)) {
            throw new TypeError('Object, type, tag, tagger, and message required');
        }
        return {
            object: body.object,
            type: body.type,
            tag: body.tag,
            tagger: normalizePerson(body.tagger),
            message: body.message
        };
    }
    function normalizePerson(person) {
        if (!person || typeof person !== 'object') {
            throw new TypeError('Person must be an object');
        }
        if (typeof person.name !== 'string' || typeof person.email !== 'string') {
            throw new TypeError('Name and email are required for person fields');
        }
        return {
            name: person.name,
            email: person.email,
            date: person.date || new Date()
        };
    }
    var object_codec_3;
    return {
        setters: [
            function (object_codec_3_1) {
                object_codec_3 = object_codec_3_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("lib/index", ["lib/object-codec", "lib/util", "lib/modes"], function (exports_8, context_8) {
    "use strict";
    var __moduleName = context_8 && context_8.id;
    function exportStar_1(m) {
        var exports = {};
        for (var n in m) {
            if (n !== "default") exports[n] = m[n];
        }
        exports_8(exports);
    }
    return {
        setters: [
            function (object_codec_4_1) {
                exportStar_1(object_codec_4_1);
            },
            function (util_1_1) {
                exportStar_1(util_1_1);
            },
            function (modes_2_1) {
                exportStar_1(modes_2_1);
            }
        ],
        execute: function () {
        }
    };
});
System.register("mixins/walkers", ["core-js/shim", "lib/index"], function (exports_9, context_9) {
    "use strict";
    var __moduleName = context_9 && context_9.id;
    function Walkers(Base) {
        return class extends Base {
            walkCommits(hash) {
                return __asyncGenerator(this, arguments, function* walkCommits_1() {
                    let commit = yield __await(this.loadAs('commit', hash));
                    let parents = commit.parents;
                    do {
                        if (!commit)
                            throw new Error('invalid hash reference');
                        yield commit;
                        commit = yield __await(this.loadAs('commit', commit.parents[0]));
                    } while (commit && commit.parents.length == 1);
                    yield commit;
                    if (commit.parents.length > 1) {
                        return 1;
                    }
                    return 0;
                });
            }
            walkTrees(hash) {
                return __asyncGenerator(this, arguments, function* walkTrees_1() {
                    let root = yield __await(this.loadAs('tree', hash));
                    let tree = { root: null };
                    let children = [{ object: { name: 'root', type: 'tree', body: root }, context: tree }];
                    let depth = 0;
                    while (children.length) {
                        let toLoad = {};
                        for (let { object, context } of children) {
                            let { type, body, name } = object;
                            if (type == 'tree') {
                                let subtree = {};
                                context[name] = subtree;
                                for (let name in body) {
                                    let { hash, mode } = body[name];
                                    toLoad[hash] = { object: { name, type: lib_1.modes.toType(mode), body: null }, context: subtree };
                                }
                            }
                            else {
                                context[name] = body;
                            }
                        }
                        let hashes = Object.keys(toLoad);
                        let objects = yield __await(this.loadMany(hashes));
                        if (hashes.length != objects.length)
                            throw new Error('missing child!');
                        children = [];
                        for (let i = 0; i < hashes.length; i++) {
                            let hash = hashes[i];
                            let object = objects[i];
                            toLoad[hash].object.body = object.body;
                            children.push(toLoad[hash]);
                        }
                        yield tree.root;
                    }
                });
            }
        };
    }
    exports_9("Walkers", Walkers);
    var lib_1;
    return {
        setters: [
            function (_1) {
            },
            function (lib_1_1) {
                lib_1 = lib_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("mixins/create-tree", ["lib/index"], function (exports_10, context_10) {
    "use strict";
    var __moduleName = context_10 && context_10.id;
    function CreateTree(Base) {
        return class extends Base {
            createTree(entries) {
                return __awaiter(this, void 0, void 0, function* () {
                    let self = this;
                    if (!Array.isArray(entries)) {
                        entries = Object.keys(entries).map((path) => Object.assign({}, entries[path], { path }));
                    }
                    // Tree paths that we need loaded
                    var toLoad = {};
                    // Commands to run organized by tree path
                    var trees = {};
                    var blobs = [];
                    function markTree(path) {
                        while (true) {
                            if (toLoad[path])
                                return;
                            toLoad[path] = true;
                            trees[path] = {
                                add: [],
                                del: [],
                                tree: {}
                            };
                            if (!path)
                                break;
                            path = path.substring(0, path.lastIndexOf('/'));
                        }
                    }
                    // First pass, stubs out the trees structure, sorts adds from deletes,
                    // and saves any inline content blobs.
                    for (let { path, mode, hash, content } of entries) {
                        let index = path.lastIndexOf('/');
                        let parentPath = path.substring(0, index);
                        let name = path.substr(index + 1);
                        markTree(parentPath);
                        let tree = trees[parentPath];
                        if (!mode) {
                            tree.del.push(name);
                            continue;
                        }
                        var add = { name, mode, hash };
                        tree.add.push(add);
                        if (hash)
                            continue;
                        blobs.push({ add, content });
                    }
                    function loadTree(path, hash) {
                        return __awaiter(this, void 0, void 0, function* () {
                            let tree = yield self.loadAs('tree', hash);
                            trees[path].tree = tree;
                            delete toLoad[path];
                            for (let name in tree) {
                                let childPath = path ? path + '/' + name : name;
                                if (toLoad[childPath]) {
                                    yield loadTree(childPath, tree[name].hash);
                                }
                            }
                        });
                    }
                    let blobHashes = yield this.saveMany(blobs.map(({ content }) => ({ type: 'blob', body: content })));
                    for (let i = 0; i < blobHashes.length; i++) {
                        blobs[i].add.hash = blobHashes[i];
                    }
                    if (entries.base) {
                        loadTree('', entries.base);
                    }
                    function findLeaves() {
                        let paths = Object.keys(trees);
                        let parents = {};
                        for (let path of paths) {
                            if (!path)
                                continue;
                            let parent = path.substring(0, path.lastIndexOf(pathSeparator));
                            parents[parent] = true;
                        }
                        return paths.filter(path => !parents[path]).sort(function (a, b) {
                            return a === '' ? 1 : -1;
                        });
                    }
                    let leaves = findLeaves();
                    while (leaves.length) {
                        let newTrees = [];
                        for (let path of leaves) {
                            let entry = trees[path];
                            delete trees[path];
                            let tree = entry.tree;
                            for (let name of entry.del) {
                                delete tree[name];
                            }
                            for (let { name, mode, hash } of entry.add) {
                                tree[name] = { hash, mode };
                            }
                            newTrees.push({ type: 'tree', body: tree });
                        }
                        let treeHashes = yield this.saveMany(newTrees);
                        for (let i = 0; i < treeHashes.length; i++) {
                            let path = leaves[i];
                            let hash = treeHashes[i];
                            if (!path) {
                                if (Object.keys(trees).length > 0)
                                    throw new Error('unfinshed!');
                                return hash;
                            }
                            let index = path.lastIndexOf(pathSeparator);
                            let parentPath = path.substring(0, index);
                            let name = path.substring(index + pathSeparator.length);
                            trees[parentPath].add.push({
                                hash,
                                name,
                                mode: lib_2.modes.tree
                            });
                        }
                        leaves = findLeaves();
                    }
                });
            }
        };
    }
    exports_10("CreateTree", CreateTree);
    var lib_2, pathSeparator;
    return {
        setters: [
            function (lib_2_1) {
                lib_2 = lib_2_1;
            }
        ],
        execute: function () {
            pathSeparator = '/';
            //function singleCall(callback) {
            //  var done = false;
            //  return function () {
            //    if (done) return console.warn('Discarding extra callback');
            //    done = true;
            //    return callback.apply(this, arguments);
            //  };
            //}
        }
    };
});
System.register("mixins/index", ["mixins/indexeddb", "mixins/memdb", "mixins/formats", "mixins/walkers", "mixins/create-tree"], function (exports_11, context_11) {
    "use strict";
    var __moduleName = context_11 && context_11.id;
    function exportStar_2(m) {
        var exports = {};
        for (var n in m) {
            if (n !== "default") exports[n] = m[n];
        }
        exports_11(exports);
    }
    return {
        setters: [
            function (indexeddb_1_1) {
                exportStar_2(indexeddb_1_1);
            },
            function (memdb_1_1) {
                exportStar_2(memdb_1_1);
            },
            function (formats_1_1) {
                exportStar_2(formats_1_1);
            },
            function (walkers_1_1) {
                exportStar_2(walkers_1_1);
            },
            function (create_tree_1_1) {
                exportStar_2(create_tree_1_1);
            }
        ],
        execute: function () {
        }
    };
});
System.register("main", ["mixins/index", "lib/index"], function (exports_12, context_12) {
    "use strict";
    var __moduleName = context_12 && context_12.id;
    return {
        setters: [
            function (mixins_1_1) {
                exports_12({
                    "MemDB": mixins_1_1["MemDB"],
                    "IndexedDB": mixins_1_1["IndexedDB"],
                    "Formats": mixins_1_1["Formats"],
                    "CreateTree": mixins_1_1["CreateTree"],
                    "Walkers": mixins_1_1["Walkers"]
                });
            },
            function (lib_3_1) {
                exports_12({
                    "modes": lib_3_1["modes"]
                });
            }
        ],
        execute: function () {
        }
    };
});
//# sourceMappingURL=main.js.map