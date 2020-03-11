filters = [
    "kaitor",
    "2020-1-1",
    "2020-1-2",
    "Golden Plate"
]


let sql = `CALL ? (${filters.map(()=>`?`).join(', ')})`
console.log(sql)
