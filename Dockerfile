# The OneLightCRM platform image: Twenty's released image with our branding (brand.mjs, brand.json),
# the client's name where users see one (BRAND_NAME, runtime.cjs) and with every call to Twenty's
# own services switched off.
# docker build --build-arg TWENTY_VERSION=v2.50.1 -t ghcr.io/onelightgroup/onelightcrm-platform:v2.50.1-olcrm.7 .
ARG TWENTY_VERSION=v2.50.1
FROM twentycrm/twenty:${TWENTY_VERSION} AS twenty

FROM node:22.11.0-alpine AS icons
WORKDIR /brand
RUN npm install --no-save --no-audit --no-fund sharp@0.33.5
COPY assets ./assets
COPY icons.mjs ./
COPY --from=twenty /app/packages/twenty-server/dist/front/images/icons ./twenty-icons
RUN node icons.mjs ./twenty-icons ./icons

FROM twenty
COPY --chown=1000:1000 --from=icons /brand/icons /app/packages/twenty-server/dist/front/images/icons
COPY --chown=1000:1000 assets/logo.svg /app/packages/twenty-server/dist/front/images/integrations/twenty-logo.svg
COPY --chown=1000:1000 runtime.cjs /app/brand/runtime.cjs
COPY --chown=1000:1000 brand.mjs brand.json VERSION /tmp/brand/
RUN node /tmp/brand/brand.mjs /app/packages /app/brand/templates && rm -rf /tmp/brand
# nothing to Twenty: no telemetry, no marketplace catalog; company logos come from the instance
# itself (brand.json `icons`, the enrichment module's route), so the web app may ask for them
ENV TELEMETRY_ENABLED=false \
    MARKETPLACE_CATALOG_SYNC_CRON_ENABLED=false \
    ALLOW_REQUESTS_TO_TWENTY_ICONS=true
LABEL org.opencontainers.image.title="OneLightCRM platform" \
      org.opencontainers.image.description="Twenty with OneLightCRM's branding" \
      org.opencontainers.image.source="https://github.com/onelightgroup/onelightcrm-platform" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
