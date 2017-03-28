var assert = require('assert');

var modes = require('../lib/modes.js');
var memdb = require('../mixins/mem-db.js');
var formats = require('../mixins/formats.js');
var createTree = require('../mixins/create-tree.js');
var createZip = require('../mixins/create-zip.js');
var sha1 = require('git-sha1');
var { deflate } = require('pako');

const EXAMPLE_TREE = {
  "www/index.html": {
    mode: modes.file,
    content: "<h1>Hello</h1>\n<p>This is an HTML page?</p>\n"
  },
  "README.md": {
    mode: modes.file,
    content: "# Sample repo\n\nThis is a sample\n"
  }
};

describe('zip mixin', function() {
  var db;
  var repo = {};
  var treeHash;

  before(async() => {
    memdb(repo);
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

      let zip = repo.createZip();

      for (let { value, path } of arr) {
        zip.file(path.join('/'), value);
      }

      let opts = { binary: true };
      for (let { hash, content } of repo.enumerateObjects()) {
        zip.file('.git/objects/' + hash.substring(0, 2) + '/' + hash.substring(2), deflate(content), opts);
      };

      zip.file('.git/refs/heads/master', commitHash + '\n', opts);
      zip.file('.git/HEAD', 'ref: refs/heads/master\n', opts);

      createIndex(arr);

      let content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

      let url = window.URL.createObjectURL(content);

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


function createIndex(arr) {
  let header = Array.from('DIRC').concat(3, arr.length);

  let entries = arr.map(({ path, value }) => {
    let name = path.slice(-1)[0];
    let mode = 8 << 12 | 420;
    let size = byteSize(value);
    let sha = sha1(value);

    let piece = [0, 0, 0, 0, 0, 0, mode, 0, 0, size];
    for (let i=0; i < sha.length; i+=5) {
      piece.push(parseInt(sha.substring(i, i+5), 16))
    }

    piece.push((1 << 16 | Math.min(name.length, 4095)) << 16);

    console.log(piece);

    return name;
  });


}

function byteSize(str) {
  return encodeURI(str).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1;
}

/*
function indexByteArray(arr) {
  // header
  let buf1 = new ArrayBuffer(12);
  let view1 = new DataView(buf1);
  // 'DIRC' signature
  Array.from('DIRC').forEach((c, i) =>view1.setUint32(i, c.charCodeAt(0), false));
  // version number
  view1.setUint32(4, 4, false);
  view1.setUint32(8, arr.length, false);

  for (let i=0; i < arr.length; i++) {
    let { value, path } = arr[i];

    let buf2 = new ArrayBuffer(40);
    let view2 = new DataView(buf2);

    // regular file     ↓ === '1000'
    view2.setUint32(24, 8, false);
    // not executable   ↓ === '0644'
    view2.setUint32(25, 420, false);
    view2.setUint32(36, content.length*16, false);

    parseInt(sha, 16);

    arr.sort((a, b) => a.path > b.path ? 1 : -1);

    console.log('v', view);
  }
}
*/

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
