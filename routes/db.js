var express = require('express');
var pool = require('./database')

var router = express.Router();

function dateRangeValidate(startDate, endDate){
  // are dates are formatted correctly
  if (startDate.match(/^\d{4}-\d{1,}-\d{1,}$/g)&&endDate.match(/^\d{4}-\d{1,}-\d{1,}$/g)) {
      // is startDate before endDate
      if (new Date(startDate.split("-").map(s=>parseInt(s))) < new Date(endDate.split("-").map(s=>parseInt(s)))) {
          return true
      }
  }
  return false
}

async function validFilters(filters){
  // if filter is not a string
  for (let filter of Object.values(filters)){
    if(typeof filter !== 'string') {
      return false
    }
  }
  // if server does not exist
  let servers = await callProcedure('serverList') // make procedure
  if (Object.values(servers).includes(filters.server)===-1) return false

  // date range validate
  if(!dateRangeValidate(filters.startDate, filters.endDate)) return false
  return true
}

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
    let filtersArr = filters?Object.values(filters):[],
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
  let { server, item, startDate, endDate } = filters
  // validate input
  let valid = await validFilters(filters)
  if(!valid){
    res.json({invalid: true})
    return
  }
  //is item found in that range?
  let sales = await callProcedure(`getSales`, filters)
  if (sales.length===0){
    res.json({notFound: true})
    return
  }
  let topSellers = await callProcedure('getTopItemSellers', filters)
  let marketValue = await callProcedure('getTotalMarketValue', {server, startDate, endDate})
  let itemMarketValue = await callProcedure(`getTotalItemMarketValue`, filters)
  // are there items in that range?
  
  res.json({topN:topSellers, sales:sales, marketValue:marketValue, itemMarketValue:itemMarketValue});
}
async function getInfo(sql, res){
  var result = await pool.query(sql)
  res.json(result[0]); //[0] excludes okpacket
}
async function getMarketTable(filters, res){
  // validate input
  let valid = await validFilters(filters)
  if(!valid){
    res.json({invalid: true})
    return
  }

  let data = await callProcedure('marketTree', filters)
  if (data.length===0){
    res.json({notFound: true})
    return
  }
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
  let valid = await validFilters(filters)
  if(!valid){
    res.json({invalid: true})
    return
  }
  // is name found in that range?

  let { server, name, startDate, endDate } = filters
  let sellerRank = await callProcedure('sellerRank', filters)
  let marketValue = await callProcedure('getTotalMarketValue', {server, startDate, endDate})
  let customCategory = await callCustomCategory()
  let quantities = await callProcedure('getSellersQuantities', filters)
  let data = await callProcedure('sellersTree', filters)
  let sellersItems = await callProcedure('getSellersItems', filters)
  if (sellersItems.length===0){
    res.json({notFound: true})
    return
  }
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

async function itemList(res){
  let items = await callProcedure('itemList')
  res.json(items.map(item=>item.string))
}

async function sellerList(res){
  let sellers = await callProcedure('sellerList')
  res.json(sellers.map(seller=>[seller.name, seller.servername]))
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
