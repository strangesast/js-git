var assert = require('assert');
var sha1 = require('git-sha1');
var { deflate } = require('pako');

var codec =      require('../lib/object-codec.js');
var modes =      require('../lib/modes.js');
var memdb =      require('../mixins/mem-db.js');
var idb =        require('../mixins/indexed-db.js');
var formats =    require('../mixins/formats.js');
var createTree = require('../mixins/create-tree.js');
var createZip =  require('../mixins/create-zip.js');

const EXAMPLE_TREE = {
  'www/index.html': {
    mode: modes.file,
    content: '<h1>Hello</h1>\n<p>This is an HTML page?</p>\n'
  },
  'README.md': {
    mode: modes.file,
    content: '# Sample repo\n\nThis is a sample\n'
  }
};

var dbName = 'test';

describe('zip mixin', function() {
  var db;
  var repo = {};
  var treeHash;

  before(async() => {
    //memdb(repo);
    db = await idb.init('testt', 1);
    idb(repo, 'testing');
    formats(repo);
    createTree(repo);
    createZip(repo);

    treeHash = await repo.createTree(EXAMPLE_TREE);
  });

  describe('archive', () => {
    it ('should create archive', async() => {
      let tree = await repo.loadAs('tree', treeHash);

      let commitHash = await repo.saveAs('commit', {
        author: {
          name: 'Sam Zagrobelny',
          email: 'strangesast@gmail.com'
        },
        message: 'Test Committtttt',
        tree: treeHash
      });

      await repo.updateRef('master', commitHash);

      await log(repo, tree);

      let arr = await flatten(repo, treeHash);

      let zip = await repo.zip.create();

      for (let { value, path } of arr) {
        zip.file(path.join('/'), value);
      }

      let opts = { binary: true };
      let objects = await repo.enumerateObjects();
      for (let { hash, content } of objects) {
        console.log('content', content);
        zip.file('.git/objects/' + hash.substring(0, 2) + '/' + hash.substring(2), deflate(content), opts);
      };

      zip.file('.git/refs/heads/master', commitHash + '\n', opts);
      zip.file('.git/HEAD', 'ref: refs/heads/master\n', opts);
      zip.file('.git/index', createIndex(arr), opts);

      let content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

      let url = window.URL.createObjectURL(content);

      console.log('here');

      /*
      let link = window.document.createElement('a');
      link.download = 'test.zip';
      link.textContent = 'Download';
      link.href = url;
      window.document.body.appendChild(link);
      link.click();
      */

      //fs.writeFile('../out/out.zip', content, (err) => console.log('err', err));
    });
  });

  after(async() => {
    console.log('finishing...');
  });
});

function byPath(a, b) {
  return a.path > b.path ? 1 : b.path > a.path ? -1 : 0;
} 
function createIndex(files) {
  let header = new Uint8Array(12);
  header.set('DIRC'.split('').map(c => c.charCodeAt(0)));
  header.set([3], 7);
  header.set(b32tob8(files.length), 8);

  files.sort(byPath);

  let res = files.reduce((accum, {path, value}) => {
    let stringPath = path.join('/').split('');
    let length = 64 + stringPath.length;
    length += 8 - (length % 8);
    let ret = new Uint8Array(length);
    let mode = (parseInt('1000', 2) << 12) | parseInt('0644', 8);
    ret.set(b32tob8(mode), 24);

    let size = byteSize(value);
    ret.set(b32tob8(size), 36);

    let sha = sha1arr(`blob ${value.length}\0${value}`);
    ret.set(sha, 40);

    let flags = (0x4000 | Math.min(stringPath.length, 0xFFF)) << 16;
    ret.set(b32tob8(flags), 60);

    let pathbytes = stringPath
      .map(c => c.charCodeAt(0))
    ret.set(pathbytes, 64);

    return accum.concat(Array.from(ret));
  }, Array.from(header));

  let sha = sha1(res);
  let shabytes = [];
  for (let i=0; i <sha.length; i+=2) {
    shabytes.push(parseInt(sha.substring(i, i+2), 16));
  }
  res.push(...shabytes);
  return Uint8Array.from(res);
}

function sha1arr(val) {
  let sha = sha1(val);
  let ret = [];
  for (let i=0; i < sha.length; i+=2) {
    ret.push(parseInt(sha.substring(i, i+2), 16));
  }
  return ret;
}

function b32tob8(v) {
  return [v >> 24 & 0xFF, v >> 16 & 0xFF, v >> 8 & 0xFF, v & 0xFF];
}

function byteSize(str) {
  return Math.min(encodeURI(str).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1, Math.pow(2, 32)/8);
}

async function log(repo, obj) {
  for (let name in obj) {
    let { mode, hash } = obj[name];
    if (mode && hash) {
      obj[name] = await repo.loadAs(modes.toType(mode), hash);
      if (mode == modes.tree) {
        await log(repo, obj[name]);
      } else if (mode == modes.blob) {
        obj[name] = obj[name].toString();
      }
    }
  }
  return obj;
}

async function flatten(repo, rootHash, prefix = []) {
  let tree = await repo.loadAs('tree', rootHash);
  let result = [];
  for (let name in tree) {
    let { mode, hash } = tree[name];
    if (mode === modes.tree) {
      result.push(...await flatten(repo, hash, prefix.concat(name)));
    } else if (mode === modes.blob) {
      let value = await repo.loadAs('text', hash);
      result.push({ path: prefix.concat(name), value });
    }
  }
  return result;
}
