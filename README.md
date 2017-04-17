# JS-Git
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/creationix/js-git?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This project is a collection of modules that helps in implementing git powered
applications in JavaScript.  The original purpose for this is to enable better
developer tools for authoring code in restricted environments like ChromeBooks
and tablets.  It also enables using git as a database to replace SQL and no-SQL
data stores in many applications.

This project was initially funded by two crowd-sourced fundraisers.  See details
in [BACKERS.md](BACKERS.md) and [BACKERS-2.md](BACKERS-2.md).  Thanks to all of
you who made this possible!

## Usage

Detailed API docs are contained in the [doc](doc) subfolder of this repository.

In general the way you use js-git is you create a JS object and then mixin the
functionality you need.  Here is an example of creating an in-memory database,
creating some objects, and then walking that tree using the high-level walker
APIs.

## Creating a repo object.

```js
// This provides symbolic names for the octal modes used by git trees.
import modes from 'js-git/lib/modes';

// Create a repo by creating a plain object.
class Repo extends 
  // This provides an in-memory storage backend that provides the following APIs:
  // - saveAs(type, value) => hash
  // - loadAs(type, hash) => hash
  // - saveRaw(hash, binary) =>
  // - loadRaw(hash) => binary
  memDBMixin(

  // This adds a high-level API for creating multiple git objects by path.
  // - createTree(entries) => hash
  createTreeMixin(

  // This provides extra methods for dealing with packfile streams.
  // It depends on
  // - unpack(packStream, opts) => hashes
  // - pack(hashes, opts) => packStream
  packOpsMixin(

  // This adds in walker algorithms for quickly walking history or a tree.
  // - logWalk(ref|hash) => stream<commit>
  // - treeWalk(hash) => stream<object>
  walkersMixin(

  // This combines parallel requests for the same resource for effeciency under load.
  readCombinerMixin(

  // This makes the object interface less strict.  See it's docs for details
  formatsMixin(

  class {})))))) {}
```

## Generators vs Callbacks

There are two control-flow styles that you can use to consume js-git APIs.  All
the examples here use `await` style and assume the code is contained within an
async function.

```js
(async function() {
 // Blocking logic goes here.  You can use yield
 var result = await someAction(withArgs);
 // The generator pauses at yield and resumes when the data is available.
 // The rest of your process is not blocked, just this generator body.
 // If there was an error, it will throw into this generator.
})();
```

If you can't use this new feature or just plain prefer node-style callbacks, all
js-git APIs also support that.  The way this works is actually quite simple.
If you don't pass in the callback, the function will return a partially applied
version of your call expecting just the callback.

```js
someAction(withArgs).then(function (value) {
  // do something with value
}).catch(handleMyError);
```

## Basic Object Creation

Now we have an in-memory git repo useful for testing the network operations or
just getting to know the available APIs.

In this example, we'll create a blob, create a tree containing that blob, create
a commit containing that tree.  This shows how to create git objects manually.

```js
  // First we create a blob from a string.  The `formats` mixin allows us to
  // use a string directly instead of having to pass in a binary buffer.
  let blobHash = await repo.saveAs("blob", "Hello World\n");

  // Now we create a tree that is a folder containing the blob as `greeting.txt`
  let treeHash = await repo.saveAs("tree", {
    "greeting.txt": { mode: modes.file, hash: blobHash }
  });

  // With that tree, we can create a commit.
  // Again the `formats` mixin allows us to omit details like committer, date,
  // and parents.  It assumes sane defaults for these.
  let commitHash = await repo.saveAs("commit", {
    author: {
      name: "Tim Caswell",
      email: "tim@creationix.com"
    },
    tree: treeHash,
    message: "Test commit\n"
  });

```

## Basic Object Loading

We can read objects back one at a time using `loadAs`.

```js
// Reading the file "greeting.txt" from a commit.

// We first read the commit.
let commit = await repo.loadAs("commit", commitHash);
// We then read the tree using `commit.tree`.
let tree = await repo.loadAs("tree", commit.tree);
// We then read the file using the entry hash in the tree.
let file = await repo.loadAs("blob", tree["greeting.txt"].hash);
// file is now a binary buffer.
```

When using the `formats` mixin there are two new types for `loadAs`, they are
`"text"` and `"array"`.

```js
// When you're sure the file contains unicode text, you can load it as text directly.
let fileAsText = await repo.loadAs("text", blobHash);

// Also if you prefer array format, you can load a directory as an array.
let entries = await repo.loadAs("array", treeHash);
entries.forEach(function (entry) {
  // entry contains {name, mode, hash}
});
```

## Using Walkers

Now that we have a repo with some minimal data in it, we can query it.  Since we
included the `walkers` mixin, we can walk the history as a linear stream or walk
the file tree as a depth-first linear stream.

```js
// Create a log stream starting at the commit we just made.
// You could also use symbolic refs like `refs/heads/master` for repos that
// support them.
let logStream = await repo.logWalk(commitHash);

// Looping through the stream is easy by repeatedly calling waiting on `read`.
let commit, object;
while (commit = await logStream.read(), commit !== undefined) {

  console.log(commit);

  // We can also loop through all the files of each commit version.
  var treeStream = await repo.treeWalk(commit.tree);
  while (object = await treeStream.read(), object !== undefined) {
    console.log(object);
  }

}
```

## Filesystem Style Interface

If you feel that creating a blob, then creating a tree, then creating the parent
tree, etc is a lot of work to save just one file, I agree.  While writing the
tedit app, I discovered a nice high-level abstraction that you can mixin to make
this much easier.  This is the `create-tree` mixin referenced in the above
config.

```js
// We wish to create a tree that contains `www/index.html` and `README.me` files.
// This will create these two blobs, create a tree for `www` and then create a
// tree for the root containing `README.md` and the newly created `www` tree.
let treeHash = await repo.createTree({
  "www/index.html": {
    mode: modes.file,
    content: "<h1>Hello</h1>\n<p>This is an HTML page?</p>\n"
  },
  "README.md": {
    mode: modes.file,
    content: "# Sample repo\n\nThis is a sample\n"
  }
});
```

This is great for creating several files at once, but it can also be used to
edit existing trees by adding new files, changing existing files, or deleting
existing entries.

```js
var changes = [
  {
    path: "www/index.html" // Leaving out mode means to delete the entry.
  },
  {
    path: "www/app.js", // Create a new file in the existing directory.
    mode: modes.file,
    content: "// this is a js file\n"
  }
];

// We need to use array form and specify the base tree hash as `base`.
changes.base = treeHash;

treeHash = await repo.createTree(changes);
```

## Creating Composite Filesystems

The real fun begins when you create composite filesystems using git submodules.

The code that handles this is not packaged as a repo mixin since it spans several
independent repos.  Instead look to the [git-tree](https://github.com/creationix/git-tree)
repo for the code.  It's interface is still slightly unstable and undocumented
but is used in production by tedit and my node hosting service that complements tedit.

Basically this module allows you to perform high-level filesystem style commands
on a virtual filesystem that consists of many js-git repos.  Until there are
proper docs, you can see how tedit uses it at <https://github.com/creationix/tedit-app/blob/master/src/data/fs.js#L11-L21>.

## Mounting Github Repos

I've been asking Github to enable CORS headers to their HTTPS git servers, but
they've refused to do it.  This means that a browser can never clone from github
because the browser will disallow XHR requests to the domain.

They do, however, offer a REST interface to the raw [git data](https://developer.github.com/v3/git/).

Using this I wrote a mixin for js-git that uses github *as* the backend store.

Code at <https://github.com/creationix/js-github>. Usage in tedit can be seen at
<https://github.com/creationix/tedit-app/blob/master/src/data/fs.js#L31>.
