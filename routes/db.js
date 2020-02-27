var express = require('express');
var pool = require('./database')

var router = express.Router();
var app = express();

/*Actual Async Calls*/

function callMarketTree(filters){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL marketTree(?, ?, ?)`, [filters.server, filters.startDate, filters.endDate], (err, res)=>{
      if(err) throw err
      resolve(res[0])
    })
  })   
}

function callCustomCategory(){
  return new Promise((resolve, reject)=>{
    pool.query(`SELECT category, parent FROM item_categories GROUP BY category`, (err, res)=>{
      if(err) throw err
      resolve(res.map(category=>Object.values(category)))
    })
  })   
}

function callGetQuantities(filters){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL getQuantities(?, ?, ?)`, [filters.server, filters.startDate, filters.endDate], (err, res)=>{
      if(err) reject(err)
      else resolve(res[0].map(item=>[item.time, item.quantity]))
    })
  })
}

function callGetMarketTotals(filters){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL getMarketTotals(?, ?, ?)`, [filters.server, filters.startDate, filters.endDate], (err, res)=>{
      if(err) reject(err)
      else resolve(res[0][0])
    })
  })
}
function callGetTopSellers(filters){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL getTopSellers(?, ?, ?)`, [filters.server, filters.startDate, filters.endDate], (err, res)=>{
      if(err) reject(err)
      else resolve(res[0])
    })
  })
}

function callGetTopItems(filters){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL getTopItems(?, ?, ?)`, [filters.server, filters.startDate, filters.endDate], (err, res)=>{
      if(err) reject(err)
      else resolve(res[0])
    })
  })
}

/*mySQL Calls*/
async function findItem(item, res){
  var result = await pool.query('SELECT * FROM itemStrings WHERE string LIKE ?', [`%${item}%`])
  res.json(result);
}
async function itemSalesHistory(filters, res){
  console.log(filters)
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
async function getMarketTable(filters, res){
  let data = await callMarketTree(filters)
  let customCategory = await callCustomCategory()
  let quantities = await callGetQuantities(filters)
  let totals = await callGetMarketTotals(filters)
  let topSellers = await callGetTopSellers(filters)
  let topItems = await callGetTopItems(filters)
  customCategory = customCategory.map(category=>Object.values(category))
  normalizedData = []
  data.forEach(sale => {
    if(sale.category) normalizedData.push([sale.string, sale.category, sale.total, sale.total])
    else normalizedData.push([sale.string, sale.filtered, sale.total, sale.total])
  });
  let category = new Set()
  normalizedData.forEach(item =>{
    category.add(item[1])
  })
  let headers = []
  category.forEach(category=>{
    let customHeader = false
    customCategory.forEach(custom=>{
      if (custom[0].includes(category)){
        headers.push([category, custom[1], 0, 0])
        customHeader=true
      }
    })
    if (!customHeader)headers.push([category, filters.server, 0, 0])
  })
  res.json({
    marketTree: [["Item", "Parent", "Price", "Quantity"], [filters.server, null, 0, 0], ...headers, ...normalizedData],
    quantities,
    totals,
    topSellers,
    topItems
  })
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
router.post('/marketTable', (req, res)=>{
  getMarketTable(req.body, res)
})
router.post('/sellerTable', (req, res)=>{
  getMarketTable(req.body, res)
})
module.exports = router;
