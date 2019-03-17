var express = require('express');
var pool = require('./database')

var router = express.Router();
var app = express();

/*mySQL Calls*/
function getInfo(sql, callback){
  pool.query(sql, function(err, result){
    if (err) throw err;
    else callback(result);
  });
}

function findItem(item, callback){
  pool.query('SELECT * FROM strsheet_item WHERE string LIKE ?', [`%${item}%`],  function(err, result){
    if (err) throw err;
    else callback(result);
  });
}

function getTopItemSellers(filters, callback){
  pool.query(
    `SELECT name, sum(price)/10000 AS price, sum(quantity) AS quantity FROM history_item_view
    WHERE servername=?
    AND string=?
    AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?
    GROUP BY name ORDER BY sum(quantity) DESC LIMIT 10;`,
    [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`],
    function(err, result){
      if(err) throw err;
      else {
        getSales(filters, function(sales){
          getTotalMarketValue(filters, function(marketValue){
            getTotalItemMarketValue(filters, function(itemMarketValue){
              callback({topN:result, sales:sales, marketValue:marketValue, itemMarketValue:itemMarketValue});
            })
          })
        })
      }
    }
  )
}
function getSales(filters, callback){
  pool.query(
    `SELECT \`FROM_UNIXTIME(time)\`as time, AVG(price/quantity)/10000 as price, AVG(quantity) as quantity FROM history_item_view 
    WHERE servername=?
    AND string=?
    AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?
    GROUP BY DATE (time), HOUR(time) ORDER BY time ASC;`,
    [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`],
    function(err, result){
      if(err) throw err;
      else callback(result);
    }
  )
}
function getTotalMarketValue(filters, callback){
  pool.query(
    `SELECT sum(price) as total FROM history_item_view 
    WHERE servername=?
    AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?`,
    [`${filters.server}`, `${filters.startDate}`, `${filters.endDate}`],
    function(err, result){
      if(err) throw err;
      else callback(result);
    }
  )
}
function getTotalItemMarketValue(filters, callback){
  pool.query(
    `SELECT sum(price) as total FROM history_item_view
    WHERE servername=?
    AND string=?
    AND \`FROM_UNIXTIME(time)\` BETWEEN ? AND ?`,
    [`${filters.server}`, `${filters.item}`, `${filters.startDate}`, `${filters.endDate}`],
    function(err, result){
      if(err) throw err;
      else callback(result);
    }
  )
}

/*Frontend Requests*/
router.get('/serverinfo', function(req, res, next) {
  let sql = "SELECT servername as 'server', count(*)as 'sales', sum(price)/10000 as 'value' FROM history_item_view GROUP BY servername"
  getInfo(sql, function(result){
    res.json(result);
  });
});
router.get('/topN', function(req, res, next) {
  let sql = "SELECT * FROM (SELECT * FROM (SELECT servername as server, name, sum(price)/10000 as gold FROM history_item_view WHERE servername = 'Velika' GROUP BY name ORDER BY gold DESC LIMIT 10) AS T1 UNION ALL SELECT * FROM (SELECT servername as server, name, sum(price)/10000 as gold FROM history_item_view WHERE servername = 'Kaiator' GROUP BY name ORDER BY gold DESC LIMIT 10) AS T2) AS T3"
  getInfo(sql, function(result){
    res.json(result);
  });
});
router.post('/itemSearch', function(req, res){
  findItem(req.body.search, function(result){
    res.json(result);
  });
})
router.post('/itemSalesHistory', function(req, res){
  getTopItemSellers(req.body, function(result){
    res.json(result)
    //console.log(result)
  })
  
})
module.exports = router;
