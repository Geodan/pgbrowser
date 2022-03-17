module.exports = function (app, cache) {
/**
 * @swagger
 *
 * /admin/clearcache/{table}:
 *   get:
 *     description: clears the cache for the specified table.
 *     tags: ['meta']
 *     summary: 'clear cache for the specified table'
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: table
 *         description: The name of the table
 *         in: path
 *         required: true
 *         type: string 
 *     responses:
 *       200:
 *         description: result
 *       422:
 *         description: table not found or not accessible
 */
  app.get('/clearcache/:table', async (req, res)=> {
    const cacheDir = `${req.params.table}`;
    try {
      await cache.clearCache(cacheDir);
      return res.json({result: 'ok', message: `cache cleared for ${req.params.table}`})
    } catch(err) {
      res.status(500).json({error:err.message})
    }
  });
}