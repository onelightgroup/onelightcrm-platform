# OneLightCRM platform

The server image behind OneLightCRM's CRMs: [Twenty](https://github.com/twentyhq/twenty)'s released
image, unchanged in what it does, with OneLightCRM's branding, the client's name where its people
see one, and every call to Twenty's own services switched off. This repository is the complete source of what we change; Twenty's own
source is at the version named in [VERSION](VERSION).

## What changes

- The name: wherever Twenty named itself to users (page title, link previews, app manifest, every
  translation of the web app, emails and server messages in all languages, the AI chat's and
  agents' prompts, the MCP server's name, instructions and card) it is the client's, `BRAND_NAME`
  in the server's and worker's environment (up to 40 letters, digits, spaces, dots and hyphens),
  or OneLightCRM without it. [runtime.cjs](runtime.cjs) writes it in when Twenty starts, from
  copies the build keeps with a placeholder.
- Ours: the icons and the sign-in page's logo (beside the workspace's), the privacy and terms
  links, help links, the workspace logo placeholder, the email footer, and the MCP card's website,
  source and registry name.
- Emails (invitations, verification, password resets): our logo on top, the client's name in the
  text, our footer.
- Nothing goes to Twenty: telemetry and the marketplace catalog are off, company logos no longer
  come from Twenty's icon service, and the help search (which sent questions to Twenty's
  documentation server) is gone from the AI chat and from MCP.

Settings pages only workspace admins see keep Twenty's wording.

[brand.mjs](brand.mjs) makes the changes, each rule expecting the exact number of places it
changes; [icons.mjs](icons.mjs) draws the icons from [assets/logo.svg](assets/logo.svg);
[brand.json](brand.json) holds our name and links; [runtime.cjs](runtime.cjs) puts the client's
name in.

## Build

```sh
docker build --build-arg TWENTY_VERSION=v2.50.1 -t ghcr.io/onelightgroup/onelightcrm-platform:v2.50.1-olcrm.1 .
docker run -e BRAND_NAME="Acme CRM" …   # the client's name
```

CI builds `VERSION` (`<Twenty version>-olcrm.<n>`) on every push to `main` and publishes it once,
as `ghcr.io/onelightgroup/onelightcrm-platform:<VERSION>`.

## Upgrading Twenty

Set the new Twenty version in `VERSION` (and `TWENTY_VERSION` in the Dockerfile), restart the
count at `-olcrm.1`, and build. A rule whose matches changed fails the build with its name: look
at that place in the new version and update the rule.

## Licence

Twenty is licensed under the GNU Affero General Public License v3 (with some files under its own
enterprise licence, which we neither change nor enable). This work, a modification of it, is
licensed under the [AGPL-3.0](LICENSE) as well. Modified by OneLightCRM, first on 2026-10-27.
