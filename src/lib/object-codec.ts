import { modes } from './modes';

interface Person {
  name: string;
  email: string;
  date: Date | { seconds: number, offset: number };
}

interface Commit {
  tree: string;
  parents: string[];
  author: string
  committer: string;
  message: string;
}

interface Tag {
  object: any;
  type: string;
  tag: string;
  tagger: Person;
  message: string
}

export const encoders = {
  blob: encodeBlob,
  tree: encodeTree,
  commit: encodeCommit,
  tag: encodeTag
};

export const decoders = {
  blob: decodeBlob,
  tree: decodeTree,
  commit: decodeCommit,
  tag: decodeTag
};

export function frame({ type, body }: { type: string, body: any }): Uint8Array {
  let encoder = <any>encoders[type];
  body = encoder(body);
  let header = new TextEncoder().encode(`${ type } ${ body.length }\0`);
  let result = new Uint8Array(header.length + body.length);
  result.set(header);
  result.set(body, header.length);
  return result;
}

export function deframe(buffer, decode:boolean=true) {
  var space = buffer.indexOf(0x20);
  if (space < 0) throw new Error('Invalid git object buffer');
  var nil = buffer.indexOf(0x00, space);
  if (nil < 0) throw new Error('Invalid git object buffer');
  var body = buffer.slice(nil + 1);
  var size = parseDec(buffer, space + 1, nil);
  if (size !== body.length) throw new Error('Invalid body length.');
  var type = new TextDecoder().decode(buffer.slice(0, space));
  return {
    type,
    body: decode ? decoders[type](body) : body
  };
}

export function validateBody(body) {
  if (typeof body === 'string' || body instanceof Uint8Array) {
    return;
  }
  throw new Error('invalid body type');
}

function encodeBlob(body: Uint8Array) {
  if (!(typeof body === 'string' || body instanceof Uint8Array)) {
    throw new Error('blobs must be binary values');
  }
  return body;
}

export function treeMap(key) {
  let entry = this[key];
  let { mode, hash } = entry;
  return { name: key, mode, hash };
}

function treeSort(a, b) {
  let aa = (a.mode === modes.tree) ? a.name + '/' : a.name;
  let bb = (b.mode === modes.tree) ? b.name + '/' : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

function encodeTree(body: { [key: string]: { mode: number, hash: string }}) {
  if (Array.isArray(body)) {
    throw new TypeError('Tree must be in object form');
  }
  let list = Object.keys(body).map(treeMap, body).sort(treeSort);
  let encoder = new TextEncoder();
  console.log('list', list);
  let tree = list.map(({ mode, name, hash }) => mode.toString(8) + ' ' + encodeURI(name) + '\0' + hash).join('');
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
  } else {
      seconds = Math.floor(date.getTime() / 1000);
      offset = date.getTimezoneOffset();
  }
  var neg = '+';
  if (offset <= 0) {
    offset = -offset;
  } else {
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
  return `${ safe(person.name) } <${ safe(person.email) }> ${ formatDate(person.date) }`;
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

function encodeTag({ object, type, tag, tagger, message }: Tag) {
  var str = `object ${ object }\ntype ${ type }\ntag ${ tag }\ntagger ${ formatPerson(tagger) }\n\n${ message }`;
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
    if (i < 0) throw new SyntaxError('Missing space');
    mode = parseOct(body, start, i++);
    start = i;
    i = body.indexOf(0x00, start);
    name = decoder.decode(body.slice(start, i++));
    hash = body.slice(i, i+=20).map(i => ('0' + i.toString(16)).slice(-2)).join('');
    tree[name] = { mode, hash };
  }
  return tree;
}

function decodeCommit(body) {
  let i = 0,
      start,
      key,
      parents = [],
      commit: Commit = {
        tree: '',
        parents: parents,
        author: '',
        committer: '',
        message: ''
      },
      decoder = new TextDecoder();

  while (body[i] !== 0x0a) {
    start = i;
    i = body.indexOf(0x20, start);
    if (i < 0) throw new SyntaxError('Missing space');
    key = decoder.decode(body.slice(start, i++));
    start = i;
    i = body.indexOf(0x0a, start);
    if (i < 0) throw new SyntaxError('Missing linefeed');
    let value: Person | string = decoder.decode(body.slice(start, i++));
    if (key === 'parent') {
      parents.push(value);
    } else {
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
    if (i < 0) throw new SyntaxError('Missing space');
    key = decoder.decode(body.slice(start, i++));
    start = i;
    i = body.indexOf(0x0a, start);
    if (i < 0) throw new SyntaxError('Missing linefeed');
    let value: any = decoder.decode(body.slice(start, i++));
    if (key === 'tagger') value = decodePerson(value);
    tag[key] = value;
  }
  i++;
  tag.message = decoder.decode(body);
  return tag;
}

function decodePerson(string): Person {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error('Improperly formatted person string');
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
