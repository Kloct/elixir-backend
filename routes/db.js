var express = require('express');
var pool = require('./database')

var router = express.Router();
var app = express();

/*Actual Async Calls*/


function callCustomCategory(){
  return new Promise((resolve, reject)=>{
    pool.query(`SELECT category, parent FROM item_categories GROUP BY category`, (err, res)=>{
      if(err) throw err
      resolve(res.map(category=>Object.values(category)))
    })
  })   
}

function callProcedure(procedure, filters){
  return new Promise((resolve, reject)=>{
    let filtersArr = Object.values(filters),
    sql = `CALL ${procedure} (${filtersArr.map(()=>`?`).join(', ')})`
    pool.query(sql, [...filtersArr], (err, res)=>{
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
  // validate input
  // does the server exist?
  // is the date range valid
  // is this item found in the date range

  let { server, item, startDate, endDate } = filters
  let topSellers = await pool.query('CALL getTopItemSellers(?, ?, ?, ?)', [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let sales = await pool.query(`CALL getSales(?, ?, ?, ?)`, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  let marketValue = await callProcedure('getTotalMarketValue', {server, startDate, endDate})
  let itemMarketValue = await pool.query(`CALL getTotalItemMarketValue(?, ?, ?, ?)`, [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`])
  res.json({topN:topSellers[0], sales:sales[0], marketValue:marketValue, itemMarketValue:itemMarketValue[0]}); //[0] excludes okpacket
}
async function getInfo(sql, res){
  var result = await pool.query(sql)
  res.json(result[0]); //[0] excludes okpacket
}
async function getMarketTable(filters, res){
  // validate input
  // does the server exist?
  // is the date range valid?
  
  let data = await callProcedure('marketTree', filters)
  let customCategory = await callCustomCategory()
  let quantities = await callProcedure('getQuantities', filters)
  let totals = await callProcedure('getMarketTotals', filters)
  let topSellers = await callProcedure('getTopSellers', filters)
  let topItems = await callProcedure('getTopItems', filters)
  quantities = quantities.map(item=>[item.time, item.quantity])
  totals = totals[0]
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

async function getSellerTable(filters, res){
  // validate input
  // does the server exist?
  // is the date range valid?
  // is the name found in that range?

  let { server, name, startDate, endDate } = filters
  let sellerRank = await callProcedure('sellerRank', filters)
  let marketValue = await callProcedure('getTotalMarketValue', {server, startDate, endDate})
  let customCategory = await callCustomCategory()
  let quantities = await callProcedure('getSellersQuantities', filters)
  let data = await callProcedure('sellersTree', filters)
  let sellersItems = await callProcedure('getSellersItems', filters)
  quantities = quantities.map(item=>[item.time, item.quantity])
  sellerRank = sellerRank[0]
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
    if (!customHeader)headers.push([category, filters.name, 0, 0])
  })
  res.json({
    revenue: sellerRank.revenue,
    rank: sellerRank.rank,
    percentage: (sellerRank.revenue/(marketValue[0].total/10000))*100,
    sellersTree: [["Item", "Parent", "Price", "Quantity"], [filters.name, null, 0, 0], ...headers, ...normalizedData],
    sellersItems,
    quantities
  })
}

function callItemList(){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL itemList()`, (err, res)=>{
      resolve(res[0].map(item=>item.string))
    })
  })
}
async function itemList(res){
  let items = await callItemList()
  res.json(items)
}

function callSellerList(){
  return new Promise((resolve, reject)=>{
    pool.query(`CALL sellerList()`, (err, res)=>{
      resolve(res[0].map(seller=>[seller.name, seller.servername]))
    })
  })
}
async function sellerList(res){
  let sellers = await callSellerList()
  res.json(sellers)
}


/*Frontend Requests*/
router.get('/serverinfo', function(req, res, next) {
  getInfo('CALL serverinfo', res);
});
router.get('/topN', function(req, res, next) {
  getInfo('CALL topN', res);
});
router.get('/itemList', (req, res)=>{
  itemList(res)
})
router.get('/sellerList', (req, res)=>{
  sellerList(res)
})
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
  getSellerTable(req.body, res)
})
module.exports = router;
