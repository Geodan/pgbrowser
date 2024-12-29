FROM ghcr.io/osgeo/gdal:alpine-small-3.10.0
RUN mkdir -p /usr/src/app
RUN apk update && apk add --no-cache nodejs npm
WORKDIR /usr/src/app
