# Local admin proxy security boundary

The browser-facing admin proxy is a **single-operator local-development tool**. It is not an administrator interface for staging or production and must never be exposed through a LAN listener, reverse proxy, tunnel, container port publication, or public deployment.

## Supported topology

1. Run the FastAPI administrator API on the same trusted workstation or another explicitly trusted local endpoint.
2. Set `ADMIN_API_TOKEN` only in the web server process. The browser must never receive or persist it.
3. Start the web application with the dedicated loopback launcher:

```bash
npm run dev:admin -w web -- --port 3000
```

The launcher fixes the Next.js listener to `127.0.0.1`, enables the proxy only for the development runtime, and declares the loopback binding to the route handlers. It rejects attempts to override the hostname. Open the operator UI through `http://127.0.0.1:3000`.

Do not enable the proxy by running the ordinary `dev` command and setting environment variables manually. The route handlers fail closed unless the dedicated loopback binding declaration is present.

## Threat model

Trusted:

- the local operator account and workstation;
- the loopback network interface;
- the configured FastAPI administrator endpoint;
- the server-only `ADMIN_API_TOKEN` value.

Untrusted:

- other machines on the LAN or internet;
- reverse proxies, tunnels, VPN port publication, and platform forwarding layers;
- request-controlled `Host`, `Origin`, `Forwarded`, `X-Forwarded-*`, CDN client-IP, and real-IP headers;
- public build and deployment environments;
- browser content from another origin.

The primary security boundary is the operating-system listener bound to `127.0.0.1`. HTTP host, origin, and forwarding checks are defense in depth; they are not treated as proof that a request originated locally. Requests with a remote host, cross-origin origin, unsupported forwarding metadata, or non-loopback forwarding addresses are rejected before the administrator token is attached.

This design does not protect against malicious software or another user process already running on the same trusted workstation. Do not use it on a shared or untrusted host.

## Public-build safeguards

The proxy is disabled by default and returns a non-disclosing `404` when its complete local-only preconditions are absent. A production Node runtime also forces it off, even when local-development variables are supplied.

The web `build`, Cloudflare `preview`, and Cloudflare `deploy` commands run a preflight that refuses to continue when any of these local-only values are present:

- `ENABLE_LOCAL_ADMIN_PROXY` enabled;
- `LOCAL_ADMIN_PROXY_BIND_HOST` set.

A backend administrator token may exist during the repository's extended release gate, but it does not make the web proxy usable without those local-only settings. Keep administrator secrets scoped to backend or local-development processes wherever possible.

## Verification

Run the development-mode HTTP security suite:

```bash
npm run test:admin-proxy -w web
```

Verify the production artifact after building it:

```bash
npm run build -w web
npm run test:admin-proxy:production -w web
```

The tests cover default-disabled behavior, the required loopback declaration, permitted local forwarding, remote-host rejection, cross-origin rejection, spoofed forwarding metadata, missing administrator tokens, public-environment shutdown, LAN listener isolation when a non-loopback interface is available, and production-artifact shutdown.
