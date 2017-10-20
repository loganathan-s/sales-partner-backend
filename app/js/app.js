var fury = require('stromdao-businessobject')
var request = require('request-promise')
var crypto = require('crypto')

var settings = {
  apiHost: 'http://fury.network/api',
  createPartnerLedger: false
}

const globals = {
  appId: 'spapp-test', // I6C3kM4j
  provider: {
    tenantId: 'sevtest',
    ledger: {
      // address: null
    },
    node: {
      extid: 'ksadfksadljf'
    },
    users: [
      {
        tenantId: 'sevtest',
        username: 'jochentest',
        password: 'test'
      }
    ]
  }
}

var dataSet = [
  {
    salesPartner: {
      uuid: 'rakentenstom', // a tennantId namespace('ledger', uuid) =>  'ratenstrom::leder'   hash('ratenstrom::leder) => 93481230990  node.roleloup rl.relations('93481230990') => [tenantId]::[user] | entitlement | bill
      account: {
        extid: 'totally diffrent', // appid::extid => appid::extid::substr(::year)
        address: undefined
      },
      ledger: {
        address: undefined
      },
      commission: {
        account: {
          extid: undefined, // '[appId]::[extid]::[subStrg]:[YYYY}'
          address: undefined // actions.extidToAddress(extid)
        },
        rate: {
          energy: {
            value: 3,
            multiplier: 1000,
            unit: 'cent per watthour)'
          },
          basicFee: {
            value: 1200 * 1000,
            multiplier: 1000,
            unit: 'cent per year'
          }
        }
      }
    },
    customer: {
      uuid: '1000044580'
    },
    orderNumber: '10005277',
    contractAccount: {
      uuid: '20050466',
      type: 'Strom'
    },
    contract: {
      uuid: '5000161171'
    },
    meterpoint: {
      number: '60668720',
      account: {
        extid: '60668720',
        address: '0xEAA8789b2f942d66A880731ffFD24f56E87Cf809' // Stefan's meter, TODO: Meter number etc.
      }
    },
    startDate: new Date('2017-08-25T12:27:22'),
    startReading: {
      time: new Date('2017-08-25T12:27:22').getTime(),
      value: Math.round(4153906 / 10), // 415.3906000 Wh
      unit: 'watthours',
      multiplier: 10000 / 10
    },
    endDate: undefined, // new Date('9999-12-31T23:59:59')
    endReading: undefined,
    invoicingPeriod: { value: 365, multiplier: 1, unit: 'days' }, // 365*86400000 ms
    consumptionEstimate: {
      value: 1050 * 1000 * 1000,
      multiplier: 1000,
      unit: 'watthours'
    },
    currentReading: {
      time: undefined,
      value: undefined,
      unit: undefined,
      multiplier: undefined
    }
  }
]

// create root node
var node = new fury.Node({
  external_id: globals.provider.node.extid,
  testMode: true,
  rpc: 'https://demo.stromdao.de/rpc=',
  abilocation:
    'https://cdn.rawgit.com/energychain/StromDAO-BusinessObject/6dc9e073/smart_contracts/'
})
console.info('node extid: ', globals.provider.node.extid)
console.log('app root node crated: ', node.wallet.address)
console.log('root node pk: ', node.wallet.privateKey)

// create root ledger
if (!globals.provider.ledger.address) {
  console.info('creating root ledger.')

  // // console.log(node)
  // ethers.Wallet.fromBrainWallet("support@ethers.io", "password123").then(function(wallet) {
  //   console.log("Address: " + wallet.address);
  // });
  node
    .mpr()
    .then(mp => {
      // console.log(mp)
      return mp.readings('0x7a24378c76926b10D9dE2fDF5A803339D3340f40')
    })
    .then(reading => console.log(reading))

  // node.stromkontoproxyfactory()
  //   .then(skf => {
  //     console.log(skf)
  //     // skf.build()
  //   })
}

var dataApi = createDataApi(settings)
var actions = createActions(dataApi)

// createTestrun(dataSet, dataApi, node, actions)

function createTestrun (dataSet, dataApi, node, actions) {
  dataSet.map(o => {
    if (settings.createPartnerLedger) {
      o.salesPartner.uuid =
        o.salesPartner.uuid || crypto.randomBytes(3).toString('hex')
      let uuid = o.salesPartner.uuid
      let partnerNode = new fury.Node({
        external_id: uuid,
        testMode: true
      })
      console.log('---partner node---')
      console.info('extid: ', o.salesPartner.uuid)
      console.info('address: ', partnerNode.wallet.address)
      console.info('privateKey: ', partnerNode.wallet.privateKey)
      console.info('check local node: ', node.wallet.address)
      partnerNode
        .stromkontoproxyfactory()
        .then(skpf => {
          console.info(
            'check partnerNode inside skpf: ',
            partnerNode.wallet.address
          )
          return skpf.build()
        })
        .then(pLedgerAddress => {
          console.info('pLedger address :', pLedgerAddress)
          return partnerNode.stromkontoproxy(pLedgerAddress)
        })
        .then(pLedger => {
          console.info(
            'check node before pledger.modifySender :',
            node.wallet.address
          )
          return pLedger.modifySender(node.wallet.address, true)
        })
        .then(txKey => {
          console.info('pLedger.modifySender success: ', txKey)
        })
    }
    return

    actions
      .getCurrentReading(o)
      .then(reading => {
        o.currentReading.time = reading.time.toNumber() * 1000 // turn time from seconds to milliseconds
        o.currentReading.value = reading.power.toNumber()
        o.currentReading.multiplier = 1000
        o.currentReading.unit = 'watthours'
        console.info('current reading:')
        console.info(o.currentReading)
      })
      .then(() => {
        return Promise.all([
          actions.getSubAccount(
            o.contractAccount.uuid,
            'calcEntitlement',
            true
          ),
          actions.getSubAccount(o.salesPartner.uuid, 'entitlement', false)
        ])
      })
      .then(subAccounts => {
        let txMaterial = {}
        let entitlement = actions.calcEntitlement(o)
        txMaterial.ledger = globals.provider.ledger.address
        txMaterial.from = subAccounts[0]
        txMaterial.to = subAccounts[1]
        txMaterial.entitlement = [entitlement.energy, entitlement.period]
        console.info('Success! Tx material created:')
        console.info(txMaterial)
        makeTransaktion(txMaterial)

        function makeTransaktion (txMaterial) {
          console.log('ledger: ', txMaterial.ledger)
          console.log('from: ', txMaterial.from.address)
          console.log('to: ', txMaterial.to.address)
          console.log(
            'entitlement: ',
            txMaterial.entitlement[0],
            txMaterial.entitlement[1]
          )
          actions
            .fetchAccountHaben(txMaterial.ledger, txMaterial.to.address)
            .then(accountHaben => {
              console.log('accountHaben:')
              console.log(accountHaben)
              // TODO this is not done yet.
            })
        }
      })
      .catch(err => console.error(err))

    /* calculate the metered and in advance commission entitlement */
    // txMaterial = createTxMaterial(o)
  })
}

// })
// .then(obj => {
//   console.log(obj)
//   let entitlementObj = {
//     energy: {
//       value: obj.meteredEntitlement.valueEnergy.value + obj.inAdvanceEntitlement.valueEnergy.value,  // TODO Check if multiplier and units are same
//       base: obj.meteredEntitlement.baseEnergy.value + obj.inAdvanceEntitlement.baseEnergy.value // TODO Check if multiplier and units are same
//     },
//     period: {
//       value: obj.meteredEntitlement.valuePeriod.value + obj.inAdvanceEntitlement.valuePeriod.value, // TODO Check if multiplier and units are same
//       base: obj.meteredEntitlement.basePeriod.value + obj.inAdvanceEntitlement.basePeriod.value // TODO Check if multiplier and units are same
//     }
//   }

//   let from = buildAddress(dataSet.provider.extid, 'customer' + o.customerAccount)
//   let to = buildAddress(o.salesPartner.account.extid, 'entitlement')

//   Promise.all([
//     from, to
//   ])
//     .then(arr => {
//       let fromAddress = arr[0].address
//       let toAddress = arr[1].address

//       createTx(arr[0], arr[1], entitlementObj)
//     })

// //
// // console.log(txMaterial)

//   function createTx (fromObj, toObj, entiObj) {
//     console.log('from: ', fromObj)
//     console.log('to: ', toObj)
//     console.log('entitlementObj: ', entiObj)
//     return fetchHaben(globals.provider.ledger.address, toObj.address)
//       .then(toHaben => {
//         let tx1
//         let sumEntitlement = entiObj.energy.value + entiObj.period.value
//         console.log('sumTxValue: ', entiObj.energy.value + entiObj.period.value)
//         console.log('toHaben: ', toHaben)
//         console.log('entitlement > toHaben ? ', (entiObj.energy.value + entiObj.period.value) > toHaben)
//         console.log('entitlement  toHaben delta => ', (entiObj.energy.value + entiObj.period.value) - toHaben)

//         if (!sumEntitlement > toHaben) {
//           return
//         }
//         tx1 = { from: fromObj.address, to: toObj.address, value: entiObj.period.value - toHaben, base: (entiObj.period.value - toHaben) / Math.round(o.salesPartner.commission.rate.basicFee.value / actions.getDaysInYear((new Date()).getFullYear())) }
//         console.log('tx1 (forPeriod):  ', tx1)
//       })
//       .catch(err => console.log(err))

//   }

// function makeTx (ledgerAddress, fromAddress, toAddress, value, base) {
//   return node.stromkonto(ledgerAddress)
//     .then(ledger => {
//       return ledger.addTx(fromAddress, toAddress, value, base)
//     })
//     .then(txID => {
//       return fetchHaben(ledgerAddress, toAddress)
//     })
// }

// node.stromkonto(dataSet.ledger)
//   .then(sko => {
//     sko.addTx(from, to, value, energy)
//   })
// })
// .catch(err => console.error(err))

// .then()
//       .then(reading => {
//         let timeDelta = (o.currentDate - o.startDate)
//         let readingDelta = o.currentReading - o.startReading
//         console.log(o)
//         console.log('days since startDate: ', (timeDelta / 86400000).toFixed())
//         console.log('kWh since startRading: ', (readingDelta / 1000000).toFixed())
//         return {
//           id: o.salesPartnerId,
//           entitlement: {
//             account: {},
//             gpBase:  (timeDelta / 86400000),
//             gpVal: o.gp.value * (timeDelta / 86400000),
//             apBase: (readingDelta / 1000000),
//             apVal: o.ap.value * (readingDelta / 1000000)
//           }
//         }
//       })
//       .then((salesPartner) => {
//         console.log('salesPartner:  ', salesPartner)
//         // get current state of truth
//         let extidStrings = {
//           period: ':' + (new Date()).getFullYear(),
//           role: [':admin', ':salesPartner'],
//           customerId: ':' + o.customerAccount,
//           billingAddress: ':billing',
//           entitlementAddress: ':entitlement',
//           bankAccount: ':' + 'DE491834180412852185'
//         }
//         let partnerEntitlementString = o.salesPartnerId + extidStrings.period + extidStrings.role[1] + extidStrings.entitlementAddress
//         console.log(partnerEntitlementString)
//         salesPartner.entitlement.account.extid = partnerEntitlementString
//         return salesPartner
//       })
//       .then(salesPartner => {
//         return actions.extidToAddress(salesPartner.entitlement.account.extid)
//           .then(entitlementAccount => {
//             salesPartner.entitlement.account = entitlementAccount
//             return salesPartner
//           })
//       })
//       .then(salesPartnerObj => {
//         console.info(salesPartnerObj)
//         return node.stromkonto(dataSet.ledger)
//           .then(sk => {
//             return Promise.all([
//               sk.balancesHaben(salesPartnerObj.entitlement.account.address),
//               sk.balancesSoll(salesPartnerObj.entitlement.account.address)
//               ])
//               .then(a => {
//                 salesPartnerObj.entitlement.account.credit = a[0]
//                 salesPartnerObj.entitlement.account.debit = a[1]
//                 console.info('spoEntitlement:  ', salesPartnerObj.entitlement)
//                 return salesPartnerObj
//               })
//               .catch(err => {
//                 console.error(err)
//               })
//           })
//       })
//       .then(salesPartner => {
//         // calculate commission entitlement
//         let commGpBase = o.currentDate && o.startDate ? (o.currentDate - o.startDate ) : 0
//         let commGpValue = commGpBase * o.gp.value / o.gp.multiplierer
//         let commApBase = o.currentReading && o.startReading ? o.currentReading - o.startReading : 0

//         // calculate commission advance
//         let now = Date.now()
//         let commGpaBase = o.currentDate
//           ? now - o.currentDate
//           : now - o.startDate
//         let commApaBase = o.currentDate
//           ? (now - o.currentDate) * (o.consumptionPerPeriod / o.invoicingPeriod)
//           : (now - o.startDate) * (o.consumptionPerPeriod / o.invoicingPeriod)
//         console.log(
//           {
//             commGpBase: commGpBase,
//             commApBase: commApBase
//           }, {
//             commGpaBase: commGpaBase,
//             commApaBase: commApaBase
//           }
//         )
//       })

function createDataApi (settings) {
  return {
    authenticateRemoteNode: authenticateRemoteNode,
    fetchRemoteNodeAddress: fetchRemoteNodeAddress
  }

  function authenticateRemoteNode (extid, secret) {
    return request({
      uri: settings.apiHost + '/auth/' + extid + '/' + secret,
      json: true
    })
  }

  function fetchRemoteNodeAddress (extid, token) {
    return request({
      type: 'GET',
      url: settings.apiHost + '/info/' + extid + '?token=' + token,
      json: true
    })
  }
}

function createActions (dataAPI) {
  return {
    getSubAccount: getSubAccount,
    calcEntitlement: calcEntitlement,
    getCurrentReading: getCurrentReading,
    getDaysInYear: getDaysInYear,
    fetchAccountHaben: fetchAccountHaben,
    fetchMeterpointReading: fetchMeterpointReading
  }

  function getCurrentReading (o) {
    if (o.meterpoint.account.address) {
      return fetchMeterpointReading(
        o.meterpoint.account.address
      ).then(reading => {
        console.info('new reading from ', o.meterpoint.account.address)
        return reading
      })
    }

    if (!o.meterpoint.account.address) {
      return new Promise((resolve, reject) => {
        if (
          !o.currentReading.time ||
          !o.currentReading.value ||
          !o.currentReading.multiplier ||
          o.currentReading.unit !== 'watthours'
        ) {
          reject('o.currentReading is not well formarted. Skipping entry.')
        }
        resolve(o.currentReading)
      })
    }
  }

  function getSubAccount (extid, subStr, appendYear) {
    let str
    let xx = '::'
    let appId = globals.appId ? globals.appId + xx : ''
    let subString = subStr ? xx + subStr : ''
    let year = appendYear ? xx + new Date().getFullYear() : ''

    if (!extid) {
      throw new Error('extid is required to build address')
    }

    str = appId + extid + subString + year
    return addressFromExtid(str)
  }

  function addressFromExtid (extid, password) {
    var secret = password || crypto.randomBytes(4).toString('hex')
    return dataAPI
      .authenticateRemoteNode(extid, secret)
      .then(res => {
        console.info(
          'remote node authenticated: extid: ',
          extid,
          ', secret: ',
          secret
        )
        // console.info(res)
        return dataAPI
          .fetchRemoteNodeAddress(extid, res.token)
          .then(address => {
            return {
              extid: extid,
              secret: secret,
              address: address,
              token: res.token
            }
          })
      })
      .catch(err => console.error(err))
  }

  function fetchAccountHaben (ledgerAddress, accountAddress) {
    return node.stromkonto(ledgerAddress).then(ledger => {
      return ledger.balancesHaben(accountAddress)
    })
  }

  function fetchMeterpointReading (meterpointAddress) {
    return node.mpr().then(mpr => {
      return mpr.readings(meterpointAddress)
    })
  }

  function getDaysInYear (year) {
    return isLeapYear(year) ? 366 : 365
  }

  function isLeapYear (year) {
    return year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)
  }

  function calcEntitlement (o) {
    if (
      o.currentReading.unit !== o.startReading.unit ||
      o.currentReading.multiplier !== o.startReading.multiplier
    ) {
      throw new Error(
        'data.map startReading / currentReading units and multiplier must be identical!'
      )
    }

    const timeNow = Date.now()
    const energy = {}
    const period = {}
    const entitlement = {}

    /* caltulate total energy and period */

    energy.metered = {}
    energy.metered.multiplier = o.currentReading.multiplier || undefined
    energy.metered.unit = o.currentReading.unit || undefined
    energy.metered.value = o.currentReading.value
      ? o.currentReading.value - o.startReading.value
      : 0

    energy.inAdvance = {}
    energy.inAdvance.multiplier =
      o.consumptionEstimate.multiplier / o.invoicingPeriod.multiplier
    energy.inAdvance.unit = o.consumptionEstimate.unit
    energy.inAdvance.value = o.currentReading.value
      ? Math.round(
        (timeNow - o.currentReading.time) /
            86400000 *
            (o.consumptionEstimate.value / o.invoicingPeriod.value)
      ) // days * (wh/day)
      : Math.round(
        (timeNow - o.startDate.getTime()) /
            86400000 *
            Math.round(o.consumptionEstimate.value / o.invoicingPeriod.value)
      ) // days * (wh/day)

    // console.info('metered energy: ', energy.metered.value / energy.metered.multiplier, ' ', energy.metered.unit)
    // console.info('anticipated energy: ', energy.inAdvance.value / energy.inAdvance.multiplier, ' ', energy.inAdvance.unit)
    // console.info('sum: ', (energy.metered.value + energy.inAdvance.value) / energy.inAdvance.multiplier)

    period.metered = {}
    period.metered.multiplier = 1000
    period.metered.unit = 'days'
    period.metered.value = o.currentReading.time
      ? Math.floor((o.currentReading.time - o.startDate.getTime()) / 86400000) *
        period.metered.multiplier // millisec to days rounded down * 1000
      : 0

    period.inAdvance = {}
    period.inAdvance.multiplier = 1000
    period.inAdvance.unit = 'days'
    period.inAdvance.value = o.currentReading.time
      ? Math.floor((timeNow - o.currentReading.time) / 86400000) *
        period.inAdvance.multiplier // millisec to days rounded down * 1000
      : Math.floor((timeNow - o.startDate.getTime()) / 86400000) *
        period.inAdvance.multiplier

    // console.info('metered period: ', period.metered.value / period.metered.multiplier, ' ', period.metered.unit)
    // console.info('calculated period: ', period.inAdvance.value / period.inAdvance.multiplier, ' ', period.inAdvance.unit)
    // console.info('sum: ', (period.metered.value + period.inAdvance.value) / period.inAdvance.multiplier)

    /* Calc entitlement for energy sold */

    if (
      energy.metered.multiplier !== energy.inAdvance.multiplier ||
      energy.metered.unit !== energy.inAdvance.unit
    ) {
      console.warn(
        'energy multipliers und units must be the same! (should be 1000 and "watthours")'
      )
    }

    entitlement.energy = {}
    entitlement.energy.rate = o.salesPartner.commission.rate.energy
    entitlement.energy.base =
      energy.metered.multiplier === energy.inAdvance.multiplier &&
      energy.metered.unit === energy.inAdvance.unit
        ? energy.metered
        : undefined
    entitlement.energy.base.value += energy.inAdvance.value

    entitlement.energy.multiplier =
      entitlement.energy.base.multiplier * entitlement.energy.rate.multiplier
    entitlement.energy.unit = 'eurocent'
    entitlement.energy.value =
      entitlement.energy.base.value * entitlement.energy.rate.value

    /* Calc entitlement for contract duration period */

    if (
      period.metered.multiplier !== period.inAdvance.multiplier ||
      period.metered.unit !== period.inAdvance.unit
    ) {
      console.warn(
        'period multipliers und units must be the same! (should be 1000 and "days")'
      )
    }

    entitlement.period = {}
    entitlement.period.rate = o.salesPartner.commission.rate.basicFee
    entitlement.period.base =
      period.metered.multiplier === period.inAdvance.multiplier &&
      period.metered.unit === period.inAdvance.unit
        ? period.inAdvance
        : undefined
    entitlement.period.base.value += period.metered.value

    entitlement.period.multiplier =
      entitlement.period.base.multiplier * entitlement.period.rate.multiplier
    entitlement.period.unit = 'eurocent'
    entitlement.period.value =
      entitlement.period.base.value *
      Math.round(
        entitlement.period.rate.value / getDaysInYear(new Date().getFullYear())
      )

    console.info('sucess! Entitlement calculation done.')
    console.info(entitlement)
    return entitlement
  }
}

//

// setInterval(
//   function() {
//     return node.singleclearing('0xb246a09653309173b249aa98050aeDE61aEd6c8F')
//       .then(function(smpc) {
//         console.log('starting new interval')
//         return smpc.clearing()
//       })
//       .then(tx => {
//         console.log('smpc clearing: ', tx)
//         // return node.stromkontoproxy('0x61376Fd79cE4f75019f41E1630afC12530734639')
//       })
//   }, 60000)

// node.singleclearing()
//   .then(smpc => {
//     return smpc.addTx(
//       '0x9A2f4d30048491a0Cb0c5B428fe11f9D5c01DEc2',
//       '0xe473F43236F8F82Ed88d5c75F673197bE68F699C',
//       5,
//       1
//       )
//   })
//   .then(tx => {console.log('test tx:', tx)})

// node.singleclearing('0xc2C30A394f0188Ebc140431BA39C6470b87EF40A')
//   .then(spmpc => {
//     return smpc.becomeProvider('0x9A2f4d30048491a0Cb0c5B428fe11f9D5c01DEc2')
//   })
//   .then((tx) => { console.log('done', tx)})

// console.log('localNode[rakete]:', node.wallet.address)
// console.log('testAccounts:', testAccounts)

// ledger '0x61376Fd79cE4f75019f41E1630afC12530734639' /
// smpc: '0xb246a09653309173b249aa98050aeDE61aEd6c8F'

// node.singleclearing('0xb246a09653309173b249aa98050aeDE61aEd6c8F')
//   .then(function(smpc) {
//     return smpc.clearing()
//   })
//   .then(tx => {
//     console.log('smpc clearing: ', tx)
//     // return node.stromkontoproxy('0x61376Fd79cE4f75019f41E1630afC12530734639')
//   })
//   .then(ledger => {
//     return ledger.account(testAccounts.salesPartnerAccount)
//   })
//   .then(history => {
//     console.log('sales partner account: ', history)
//   })

// createStromkontoProxy()
//   .then(function(ledger) {
//     return createSingleMeterPointClearing(ledger, meter, testAccounts.salesPartnerAccount)
//       .then(function(smpc) {
//         return node.stromkontoproxy(ledger)
//           .then(function(sk) {
//             return sk.modifySender(smpc, true)
//           })
//           .then(function() {
//             return {
//               ledger: ledger,
//               smpc: smpc
//             }
//           })
//       })
//   })
//   .then(function(obj) {
//     console.log(obj)
//     return node.singleclearing(obj.smpc)
//   })
//   .then(function(smpc) {
//     console.log('HERE at smpc')
//     return smpc.becomeProvider(testAccounts.providerAccount)
//       .then(function(tx) {
//         console.log(tx)
//         return smpc
//       })
//   })
//   .then(function(smpc) {
//     return smpc.setAccount(testAccounts.salesPartnerAccount, 1)
//       .then(function(tx) {
//         console.log('smpc set Account',tx)
//         return smpc.activate()
//       })
//   })
//   .then(function(tx) {
//     console.log('smpc activate:  ', tx)
//   })
//   .catch(function(err) {
//     console.error(err)
//   })

// The Functions

function createAccounts () {
  var providerAccount = new fury.Node({
    external_id: 'provider',
    testMode: true
  })

  var salesPartnerAccount = new fury.Node({
    external_id: 'sales-partner',
    testMode: true
  })

  return {
    salesPartnerAccount: salesPartnerAccount.wallet.address,
    providerAccount: providerAccount.wallet.address
  }
}

function createStromkontoProxy () {
  return node.stromkontoproxyfactory().then(function (skpf) {
    return skpf.build()
  })
}

function createSingleMeterPointClearing (ledger, meterPoint, account) {
  return node
    .singleclearingfactory()
    .then(function (scf) {
      return scf.build(ledger, meterPoint, 5, account, true)
    })
    .catch(function (err) {
      console.error(err)
    })
}
