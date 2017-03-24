"use strict";

var modes = require('../lib/modes.js');

module.exports = function (repo) {
  repo.createTree = createTree;

  async function createTree(entries) {
    if (!Array.isArray(entries)) {
      entries = Object.keys(entries).map((path) => Object.assign(entries[path], { path }));
    }

    let tree = entries.base && await repo.loadAs('tree', entries.base) || {};
    let blobs = {};

    for (let entry of entries) {
      let fullpath = entry.path;
      let i = fullpath.lastIndexOf('/');
      let [path, fname] = [fullpath.substring(0, i).split('/'), fullpath.substring(i + 1)];
      let prev = tree;
      for (let dirname of path) {
        let ob = prev[dirname];
        console.log('dirname', dirname, 'ob', ob);
        if (ob && ob.mode !== modes.tree) throw new Error('file not folder');
        if (ob && ob.mode && ob.hash) {
          prev = prev[dirname] = await repo.loadAs('tree', ob.hash);
        } else if (dirname != '') {
          prev = prev[dirname] = (prev[dirname] || {});
        }
        // if dirname == '', in root so don't change prev
      }

      // added / modified
      if (entry.mode) {
        prev[fname] = fullpath;
        blobs[fullpath] = (async function({ mode, content }) {
          let type = modes.toType(mode);
          return { hash: await repo.saveAs(type, content), mode };
        })(entry);
      }
      // removed
      else {
        delete prev[fname];
      }
    }

    console.log('tree', tree);

    return collapse(tree, blobs)
  }

  async function collapse(root, blobs) {
    for (let name in root) {
      let val = root[name];
      if (val.mode && val.hash) continue;
      root[name] = typeof val == 'string' ? await blobs[val] : { hash: await collapse(root[name], blobs), mode: modes.tree };
    }
    console.log('root', root);
    return repo.saveAs('tree', root);
  }
};
