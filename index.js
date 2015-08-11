#!/usr/bin/env node

var _ = require('lodash');
var exec = require('child_process').exec;

//
// Instantiate this guy and he will go and get the snmp info
// from each host every interval (millis).
//
// We use the command line because none of the node snmp libs allow you
// to get all the different MIB keys. We assume your command line snmp
// is configured correctly.
//
// hosts:
//   consul-c1:
//     sysName.0:
//     dskAvail.1:
//     dskPercent.1:
//       min: 30
//   consul-c2:
//     sysName.0:
//     dskAvail.1:
//       max: 5351576
//     dskPercent.1:
//
// snmpGetter.info contains whatever info we have gotten so far.
// looks like this.
//
// {
//   'consul-c1': {
//     'sysName.0': 'consul-c1',
//     'dskPercent.1': 27,
//     'dskAvail.1': 5450828
//   },
//   'consul-c2': {
//     'sysName.0': 'consul-c2',
//     'dskAvail.1': 5172512,
//     'dskPercent.1': 31
//   }
// }
//
// snmpGetter.stop() shuts us down nicely.
//
function SnmpGet(hosts, interval) {
  this.hosts = hosts || {};
  this.interval = (interval || 5000);
  this.info = {};
  this.getHostsInfos();
  this.intervalID = setInterval(this.getHostsInfos.bind(this), this.interval);
}

// Full value looks something like this.
// SNMPv2-MIB::sysName.0 = STRING: consul-c2\n
// We just want the last bit w/o the newline.
//
function parseValue(stdout) {
  var ix = 0;
  if ((ix = stdout.indexOf('STRING: ')) > -1) {
    return stdout.substr(ix + 'STRING: '.length).trim();
  } else if ((ix = stdout.indexOf('INTEGER: ')) > -1) {
    return parseInt(stdout.substr(ix + 'INTEGER: '.length).trim(), 10);
  }
}

// Shut us down gracefully.
//
SnmpGet.prototype.stop = function stop() {
  clearInterval(this.intervalID);
};

// Do the real work. Command line call of snmpget.
// https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-an-snmp-daemon-and-client-on-ubuntu-14-04
//
SnmpGet.prototype.getInfo = function getInfo(host, key) {
  var cmd = 'snmpget ' + host + ' ' + key;
  var me = this;
  // console.log(cmd);
  // snmpget consul-c1 sysName.0
  exec(cmd, function(error, stdout, stderr) {
    if (error) {
      console.error('ERROR', host, key, error);
    } else {
      if (!me.info[host]) {
        me.info[host] = {};
      }
      me.info[host][key] = parseValue(stdout);
    }
  });
};

// Loop over the object names sysName.0, dskAvail.1, dskPercent.1
//
SnmpGet.prototype.getHostInfos = function getHostInfos(keys, host) {
  // console.log('getHostInfos');
  var me = this;
  _.keys(keys).forEach(me.getInfo.bind(me, host));
};

// Loop over the host names consul-c1, consul-c2
//
SnmpGet.prototype.getHostsInfos = function getHostsInfos() {
  // console.log('getHostsInfos');
  var me = this;
  _.forOwn(me.hosts, me.getHostInfos.bind(me));
};

module.exports = SnmpGet;

if (require.main === module) {
  var gtr = new SnmpGet({
    "consul-c1": {
      "sysName.0": null,
      "dskAvail.1": null,
      "dskPercent.1": {
        "min": 30
      }
    },
    "consul-c2": {
      "sysName.0": null,
      "dskAvail.1": {
        "max": 5351576
      },
      "dskPercent.1": null
    }
  }, 3000);

  setTimeout(function() {
    console.log('info', JSON.stringify(gtr.info, null, 2));
    gtr.stop();
  }, 5000);
}
