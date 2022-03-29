from osgeo/gdal:ubuntu-small-3.3.0
RUN mkdir -p /usr/src/app
RUN apt-get update && apt-get install -y nodejs npm
WORKDIR /usr/src/app
