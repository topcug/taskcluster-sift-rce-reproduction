# Taskcluster `sift` HTTP reproduction

[Taskcluster](https://github.com/taskcluster/taskcluster/blob/f48168b7c3a8a8f78c4463cde98c1218a9edc6c6/README.md#L11-L14) runs the jobs that build and test Mozilla software. This folder shows what happened when its old web-server received an [HTTP POST](https://www.apollographql.com/docs/apollo-server/workflow/requests#post-requests), a web request that carries data in its body, at `/graphql`.

The body contained a [GraphQL](https://graphql.org/learn/) query, which lets one program name the data or action it wants from another program. The request asked Taskcluster to run `expandScopes` and did not include an [`Authorization` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Authorization), the part of a web request that normally carries login credentials.

`expandScopes` passed the request's filter, the rules used to decide which permissions to keep, to [`sift@17.1.3`](https://github.com/crcn/sift.js/tree/v17.1.3), a package that checks JavaScript values against those rules. The filter contained [`$where`](https://github.com/crcn/sift.js/blob/v17.1.3/src/operations.ts#L385-L402), a `sift` option that tests each value with a supplied condition. This version of `sift` read the text inside `$where` as JavaScript code, and that code printed the following line in the Taskcluster server terminal:

```text
POC: $where ran inside the server for assume:anonymous
```

The text after `for` is a [`scope`](https://github.com/taskcluster/taskcluster/blob/f48168b7c3a8a8f78c4463cde98c1218a9edc6c6/dev-docs/best-practices/scopes.md), Taskcluster's name for a permission. The code only printed that permission and returned `true`. It did not start another program, read a file, inspect a saved password or token, or connect to another computer.

## What each file does

- [`POC.md`](./POC.md) gives the commands in order and includes the HTTP response and the lines printed by the server.
- [`start-local-server.mjs`](./start-local-server.mjs) is a [Node.js](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) script. Node.js is the program that runs Taskcluster's JavaScript on the server. The script loads Taskcluster's old `services/web-server/src/main.js` and listens on `127.0.0.1`, an address that accepts connections only from the same computer.
- [`request.json`](./request.json) stores the exact GraphQL request body sent to the local server.

## Why the start script replaces one Taskcluster service

Taskcluster's [Auth service](https://github.com/taskcluster/taskcluster/blob/f48168b7c3a8a8f78c4463cde98c1218a9edc6c6/services/auth/README.md#L1-L3) is a separate program that manages Taskcluster permissions and credentials. The web-server normally asks Auth to expand the permissions before it filters them. Starting Auth would also require its database and settings, although this test only needs the permission list that Auth returns.

The start script replaces that outgoing request with a local function that returns the same permission list it receives. In this test, the list contains `assume:anonymous`, the permission supplied in `request.json`. Taskcluster still reads the HTTP request, finds `expandScopes`, calls `Scopes.js` and `loaders/scopes.js`, passes the filter to `sift@17.1.3`, and runs the text inside `$where`. This proves that the HTTP request reaches and runs code in the old web-server after Auth returns the permissions. It does not check which permissions a real running Auth service would give an anonymous caller.

The full commands, output, safety limits, and cleanup step are in [`POC.md`](./POC.md).
