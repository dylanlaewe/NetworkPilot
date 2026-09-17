# NetworkPilot public site

This directory contains the static public pages used for NetworkPilot's Google
OAuth branding and privacy disclosures. It is deliberately independent from the
private NetworkPilot application and has no build step, runtime configuration,
provider integration, database access, or secrets.

Deploy only this directory to Cloudflare Pages:

```sh
npx wrangler pages deploy public-site --project-name networkpilot-public
```

The intended canonical pages are:

- `https://dylanlaewe.com/networkpilot/`
- `https://dylanlaewe.com/networkpilot/privacy/`
