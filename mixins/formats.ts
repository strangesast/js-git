import { Repo } from './repo';
import { fromUnicode, toUnicode } from 'bodec';
import { treeMap } from '../lib/object-codec';

type Constructor<T> = new(...args: any[]) => T;
type validType = 'blob'|'tree'|'commit'|'tag';
type extendedType = validType|'array'|'text';

class BaseRepo {
  saveAs(...args): any {}
  loadAs(...args): any {}
}

export class Formats extends BaseRepo {
  async loadAs(type: extendedType, hash) {
    let realType = <validType>(type === 'text' ? 'blob': type === 'array' ? 'tree' : type);
    let body = await super.loadAs(realType, hash);
    if (body === undefined) throw new TypeError('No object with that hash');
    if (type === 'text') body = toUnicode(body);
    if (type === 'array') body = toArray(body);
    return body;
  }

  async saveAs(type: extendedType, body) {
    type = type === "text" ? "blob":
           type === "array" ? "tree" : type;
    if (type === "blob" && typeof body === 'string') {
      body = fromUnicode(body);
    } else if (type === "tree") {
      body = normalizeTree(body);
    } else if (type === "commit") {
      body = normalizeCommit(body);
    } else if (type === "tag") {
      body = normalizeTag(body);
    }
    return super.saveAs(type, body);
  };
}

function toArray(tree) {
  return Object.keys(tree).map(treeMap, tree);
};

function normalizeTree(body) {
  var type = body && typeof body;
  if (type !== "object") {
    throw new TypeError("Tree body must be array or object");
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
};

function normalizeCommit(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Commit body must be an object");
  }
  if (!(body.tree && body.author && body.message)) {
    throw new TypeError("Tree, author, and message are required for commits");
  }
  var parents = body.parents || (body.parent ? [ body.parent ] : []);
  if (!Array.isArray(parents)) {
    throw new TypeError("Parents must be an array");
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
};

function normalizeTag(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Tag body must be an object");
  }
  if (!(body.object && body.type && body.tag && body.tagger && body.message)) {
    throw new TypeError("Object, type, tag, tagger, and message required");
  }
  return {
    object: body.object,
    type: body.type,
    tag: body.tag,
    tagger: normalizePerson(body.tagger),
    message: body.message
  };
};

function normalizePerson(person) {
  if (!person || typeof person !== "object") {
    throw new TypeError("Person must be an object");
  }
  if (typeof person.name !== "string" || typeof person.email !== "string") {
    throw new TypeError("Name and email are required for person fields");
  }
  return {
    name: person.name,
    email: person.email,
    date: person.date || new Date()
  };
};
