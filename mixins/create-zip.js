var JSZip = require('jszip');

module.exports = function(repo) {
  repo.createZip = createZip;

  function createZip(branchName) {
    return new JSZip();
  }
};
