var JSZip = require('jszip');

module.exports = function(repo) {
  var zip;

  repo.zip = {
    clear,
    create,
    addBranch
  };

  async function create(...branchNames) {
    if (branchNames.indexOf('master') == -1) {
      branchNames.push('master');
    }

    let commits = await Promise.all(branchNames.map(name => repo.readRef(name).then(hash => hash && repo.loadAs('commit', hash))));
    if (commits.some(c => c == null)) throw new Error('one or more of those names does not exist');

    await resolve(commits.map(({tree}) => tree));
    //let rootTrees = await Promise.all(commits.map(hash => repo.loadAs('commit', hash).then(({ tree }) => repo.loadAs('tree', tree))));

    zip = new JSZip();

    return zip;
  }

  async function addBranch(...branchNames) {
  }

  function clear() {
    zip = null;
  }

  function resolve(parents) {
    return Promise.all(parents.map(async(hash) => {
      console.log('h', hash);
      let parent = await repo.loadRaw(hash);

      //console.log('parent', new TextDecoder().decode(parent));

    }));
  }
}


