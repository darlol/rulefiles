// The build date the tests run with. The validator refuses data dated after it, so move it forward
// when a digest gets a later verifiedOn or item date.
// It is kept strictly after the latest verifiedOn, so a feed <updated> that took the build date instead of a digest date
// shows up in the tests.
export const TEST_DATE = '2026-10-21';
