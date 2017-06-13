export function test(run) {
  return (done) => run().then(done, e => { done.fail(e); done(); });
}
