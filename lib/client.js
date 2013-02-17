/**
 * module dependencies
 */

var dnode = require('dnode')
var MuxDemux = require('mux-demux')
var emitStream = require('emit-stream')
var pauseStream = require('pause-stream')

var event = [
  'addListener', 'on', 'once', 'removeListener', 'removeAllListeners',
  'setMaxListeners', 'listeners', 'emit'
]

var stream = [
  'readStream', 'keyStream', 'valueStream', 'writeStream'
]

module.exports = function () {
  var client = MuxDemux()
  
  var ee
  var d = dnode()
  
  d.on('remote', function (remote) {
    var db = {}
    
    /**
     * EventEmitter methods
     */
    
    event.forEach(function (method) {
      db[method] = ee[method].bind(ee)
    })
    
    /**
     * rpc methods
     */
    
    Object.keys(remote).forEach(function (method) {
      if (typeof remote[method] != 'function') return
      db[method] = remote[method].bind(remote)
    })
    
    /**
     * methods returning streams
     */
    
    stream.forEach(function (method) {
      db[method] = function () {
        var stream = pauseStream().pause()
        var id = Math.random().toString(16).slice(2)
        var args = [].slice.call(arguments)
        args.unshift(id)
        
        client.on('connection', function onConnection (c) {
          if (c.meta == id) {
            client.removeListener('connection', onConnection)
            c.pipe(stream).pipe(c)
            stream.resume()
          }
        })
        
        remote[method](args)
        
        return stream
      }
    })
    
    client.emit('remote', db)
  })
  
  client.on('connection', function (c) {
    if (c.meta == 'events') {
      ee = emitStream(c)
      ee.on('error', function (err) {
        throw err
      })
    } else if (c.meta == 'dnode') {
      d.pipe(c).pipe(d)
    }
  })
  
  return client
}