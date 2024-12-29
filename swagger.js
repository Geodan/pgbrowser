const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

/*
const YAML = require('yamljs');
const { join } = require('path');

module.exports = function(app) {
  app.get('/api-docs/spec', (req, res) => res.json(apiSpec));

  const apiSpec = YAML.load(join(__dirname, 'openapi.yaml'));

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpec,
    {
      customSiteTitle: 'Transport Planner API',
      url: './spec',
      baseUrl: './'
    }),
  );
};
*/
const swaggerDefinition = {
    info: {
        // API informations (required)
        openapi: '3.0.3',
        title: 'PGServer', // Title (required)
        version: '0.0.1', // Version (required)
        description: 'PostGIS http api', // Description (optional)
      },
      tags: [
        {
          name: 'meta',
          description: 'meta information for tables and views'
        },
        {
          name: 'geodata',
          description: 'features in common formats for direct mapping'
        }
      ],
      servers: [
        {
          url: '../',
          description: 'This Realm'
        },
        {
          url: 'https://tiles.edugis.nl/pgserver',
          description: 'Production server'
        }
      ],
}

const swaggerJSDocOptions = {
    swaggerDefinition,
    apis: [
      './mvt.js', 
      './list_layers.js', 
      './layer_columns.js', 
      './slds.js',
      './bbox.js', 
      './geojson.js', 
      './geobuf.js', 
      './query.js',
      './column_stats.js'
    ]
}

const swaggerSpec = swaggerJSDoc(swaggerJSDocOptions);

module.exports = function(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, 
      {
        customSiteTitle: 'PGServer API Documentation'
      }
    ));
}