var express = require('express');
var pool = require('./database')

var router = express.Router();
var app = express();

//query strings
let getTopItemSellers = 
`SELECT name, sum(price)/10000 AS price, sum(quantity) AS quantity FROM history_item_view
WHERE servername=?
AND string=?
AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?
GROUP BY name ORDER BY sum(quantity) DESC LIMIT 10;`,
getSales = 
`SELECT \`FROM_UNIXTIME(time)\`as time, AVG(price/quantity)/10000 as price, AVG(quantity) as quantity FROM history_item_view 
WHERE servername=?
AND string=?
AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?
GROUP BY DATE (time), HOUR(time) ORDER BY time ASC;`,
getTotalMarketValue = 
`SELECT sum(price) as total FROM history_item_view 
WHERE servername=?
AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?`,
getTotalItemMarketValue = 
`SELECT sum(price) as total FROM history_item_view
WHERE servername=?
AND string=?
AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?`,
serverinfo =  
`SELECT servername as 'server', count(*)as 'sales', sum(price)/10000 as 'value' FROM history_item_view GROUP BY servername`
topN = 
`SELECT * FROM (
  SELECT * FROM (
    SELECT servername as server, name, sum(price)/10000 as gold
    FROM history_item_view WHERE servername = 'Velika' GROUP BY name ORDER BY gold DESC LIMIT 10
  ) AS T1
  UNION ALL
  SELECT * FROM (
    SELECT servername as server, name, sum(price)/10000 as gold
    FROM history_item_view WHERE servername = 'Kaiator' GROUP BY name ORDER BY gold DESC LIMIT 10
  ) AS T2
) AS T3`


/*mySQL Calls*/
async function findItem(item, res){
  var result = await pool.query('SELECT * FROM strsheet_item WHERE string LIKE ?', [`%${item}%`])
  res.json(result);
}
async function itemSalesHistory(filters, res){
  let topSellers = await pool.query(getTopItemSellers, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let sales = await pool.query(getSales, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let marketValue = await pool.query(getTotalMarketValue, [`${filters.server}`, `${filters.startDate}`, `${filters.endDate}`])
  let itemMarketValue = await pool.query(getTotalItemMarketValue, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  res.json({topN:topSellers, sales, marketValue, itemMarketValue});
}
async function getInfo(sql, res){
  var result = await pool.query(sql)
  res.json(result);
}
/*Frontend Requests*/
router.get('/serverinfo', function(req, res, next) {
  getInfo(serverinfo, res);
});
router.get('/topN', function(req, res, next) {
  getInfo(topN, res);
});
router.post('/itemSearch', function(req, res){
  findItem(req.body.search, res);
});
router.post('/itemSalesHistory', function(req, res){
  itemSalesHistory(req.body, res);
});
module.exports = router;
