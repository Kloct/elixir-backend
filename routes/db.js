var express = require('express');
var pool = require('./database')

var router = express.Router();
var app = express();

/*mySQL Calls*/
async function findItem(item, res){
  var result = await pool.query('SELECT * FROM strsheet_item WHERE string LIKE ?', [`%${item}%`])
  res.json(result);
}
async function itemSalesHistory(filters, res){
  let topSellers = await pool.query('CALL getTopItemSellers(?, ?, ?, ?)', [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let sales = await pool.query(`CALL getSales(?, ?, ?, ?)`, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let marketValue = await pool.query(`CALL getTotalMarketValue(?, ?, ?)`, [`${filters.server}`, `${filters.startDate}`, `${filters.endDate}`])
  let itemMarketValue = await pool.query(`CALL getTotalItemMarketValue(?, ?, ?, ?)`, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  res.json({topN:topSellers[0], sales:sales[0], marketValue:marketValue[0], itemMarketValue:itemMarketValue[0]}); //[0] excludes okpacket
}
async function getInfo(sql, res){
  var result = await pool.query(sql)
  res.json(result[0]); //[0] excludes okpacket
}
/*Frontend Requests*/
router.get('/serverinfo', function(req, res, next) {
  getInfo('CALL serverinfo', res);
});
router.get('/topN', function(req, res, next) {
  getInfo('CALL topN', res);
});
router.post('/itemSearch', function(req, res){
  findItem(req.body.search, res);
});
router.post('/itemSalesHistory', function(req, res){
  itemSalesHistory(req.body, res);
});
module.exports = router;
