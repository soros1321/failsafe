// npm i axios cookies
axios = require('axios')
l = console.log
crypto = require('crypto')
rand = () => crypto.randomBytes(32).toString('hex')

Cookies = require('cookies')
fs = require('fs')
users = {}


FS_PATH = '/Users/homakov/work/8002'
if (fs.existsSync(FS_PATH+'/private/pk.json')) {
  auth_code = JSON.parse(fs.readFileSync(FS_PATH+'/private/pk.json')).auth_code
  l("Auth "+auth_code)
} else {
  throw "No auth"
}
FS = (method, params, cb) => {
  axios.post('http://0.0.0.0:8002/rpc', {
    method: method,
    auth_code: auth_code,
    params: params
  }).then(cb)
}




commy = (b, dot = true) => {
  let prefix = b < 0 ? '-' : ''

  b = Math.abs(b).toString()
  if (dot) {
    if (b.length == 1) {
      b = '0.0' + b
    } else if (b.length == 2) {
      b = '0.' + b
    } else {
      var insert_dot_at = b.length - 2
      b = b.slice(0, insert_dot_at) + '.' + b.slice(insert_dot_at)
    }
  }
  return prefix + b.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}


require('http').createServer((req, res) => {
  cookies = new Cookies(req, res)

  res.status = 200

  var id = cookies.get('id')

  if (req.url == '/') {
    if (!id) {
      id = rand()
      cookies.set('id', id)
    }
    if (!users[id]) users[id] = 0

      require('serve-static')('../wallet')(req, res, require('finalhandler')(req, res))

    res.end(`


<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
  </head>

  <body>
    <main role="main" class="container">
      <h1 class="mt-5">Bank / Exchange Integration Demo</h1>

      <p>You're logged in as random user and your balance is simply stored in app's memory.</p>

      <p>Bank ID: ${id}</p>
      <p>Available Balance: \$${commy(users[id])}</p>

      <h3>Deposit</h3>
      <p class="form-label-group">
        <input id="amount" placeholder="Amount">
      </p>
      <p><button class="btn btn-success" id="deposit">Deposit</button></p>

      <h3>Withdraw</h3>
      <p><input type="text" id="withdraw_invoice" placeholder="Paste payment request here"></p>
      <p><small>To withdraw create a payment request in your Failsafe wallet</small></p>
      <p><button class="btn btn-success" id="withdraw">Withdraw</button></p>

   </main>


<script>
l=console.log

FS = (method, params={})=>{
  return new Promise((resolve,reject)=>{
    var id = FS.resolvers.push(resolve) - 1

    FS.frame.contentWindow.postMessage({
      method: method,
      params: params,
      id: id
    }, FS.origin)

  })
}

var hash = location.hash.split('auth_code=')
if(hash[1]){
  localStorage.auth_code = hash[1].replace(/[^a-z0-9]/g,'')
  history.replaceState(null,null,'/#wallet')
}

FS.frame=false;
FS.origin = 'http://0.0.0.0:8001'
FS.frame=document.createElement('iframe');
FS.frame.style.display = 'none'
FS.frame.src=FS.origin+'/sdk.html'
document.body.appendChild(FS.frame)
FS.onready = fn => {
  if(FS.ready == true){
    fn()
  }else{
    FS.ready = fn
  }
}
FS.resolvers = [()=>{
  if(FS.ready){
    FS.ready()
    FS.ready = true
  }
}]
window.addEventListener('message', function(e){
  if(e.origin == FS.origin){
    var data = JSON.parse(e.data)
    l(data)

    FS.resolvers[data.id](data.result)
    
  }
})

</script>
<script>
//FYI sandbox="allow-scripts allow-modals" won't bypass it btw

unpackInvoice = (i) => {
  var i = i.split('_')
  return {
    amount: i[0],
    userId: i[1],
    hubId: i[2],
    invoice: i[3]
  }
}

window.onload = function(){

  withdraw.onclick = function(){
    axios.post('/init', {
      withdraw_invoice: unpackInvoice(withdraw_invoice.value)
    }).then((r2)=>{
      if (r2.data.status == 'paid') {
        location.reload()
      } else {
        alert(r2.data.error)
      }
    })
  }

  deposit.onclick = function(){
    axios.post('/init', {
      amount: parseFloat(amount.value)*100
    }).then(r=>{
      console.log("Invoice to pay: " + r.data)
      var unpacked = unpackInvoice(r.data)

      FS('send', unpacked).then(data=>{
        if (data.secret){
          axios.post('/init', {
            deposit_invoice: unpacked.invoice
          }).then((r2)=>{
            console.log(r2.data)
            location.reload()
          })

        }

      })
 
    })
  }
}
</script>
</body></html>

      `)
  } else if (req.url == '/init') {
    var queryData = ''
    req.on('data', function (data) { queryData += data })

    req.on('end', function () {
      var p = JSON.parse(queryData)

      if (p.deposit_invoice) {

        FS('invoice', {invoice: p.deposit_invoice}, r => {
          if (r.data.status == 'paid' && r.data.extra == id) {
            users[id] += r.data.amount
          } else {
            console.log('Not paid')
          }
          res.end(JSON.stringify({status: 'paid'}))
        })

      } else if (p.withdraw_invoice) {
        if (users[id] < p.withdraw_invoice) {
          l("Not enough balance")
          return false
        }

        users[id] -= p.withdraw_invoice.amount

        FS('send', p.withdraw_invoice, r => {
          if (r.data.status == 'paid') {
            l("Withdrawn")
          } else {
            console.log('Expired')
          }

          res.end(JSON.stringify({status: 'paid'}))
        })

      } else if (p.amount) {

        FS('invoice', {
            amount: p.amount,
            asset: p.asset,
            extra: id
          }, r => {
          res.end(JSON.stringify(r.data.new_invoice))
        })
      }
    })
  } else {
    l('Not found ' + req.url)
  }
}).listen(3010)

require('../lib/opn')('http://0.0.0.0:3010')

