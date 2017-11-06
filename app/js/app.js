const fury = require('stromdao-businessobject')
const ethers = require('ethers')
const djb = require('js-hash/djb2')
var crypto = require('crypto')

const app = {
  appid: 'spapptest',
  apiHost: 'http://fury.network/api',
  rpcHost: 'https://demo.stromdao.de/rpc=',
  rootnode: {
    tenantId: 'sevtest',
    username: 'root',
    password: 'rootsecret',
    address: '0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E',
    privateKey:
      '0xf1e07118a448dcef563626da98ef98b37f66a7d84d6c1176242556d350ca1b70',
    provider: null,
    ledger: {
      tenantId: 'sevtest',
      address: '0x691C0173bbAF9B8e8293D6d6b145bbb775B1A84e'
    }
  }
}

var dataSet = [
  {
    salesPartner: {
      uuid: 'rakentenstom',
      rate: {
        energy: {
          value: 300,
          multiplier: 100000,
          unit: 'eurocent',
          unitDivisor: 'per watthour'
        },
        basicFee: {
          // value: 730,
          // multiplier: 1,
          // unit: 'eurocent per year' // IMPORTANT: should allways be in 'eurocent' w/ multiplier = 100000
          value: Math.round(
            730 * 100000 / getDaysInYear(new Date().getFullYear())
          ),
          multiplier: 100000,
          unit: 'eurocent', // IMPORTANT: should allways be in 'eurocent' w/ multiplier = 100000
          unitDivisor: 'per day'
        }
      }
    },
    customer: {
      uuid: '30091981'
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
      number: '60668720'
      // address: '0xEAA8789b2f942d66A880731ffFD24f56E87Cf809',  // Stefan's meter, TODO: Meter number etc.
    },
    startDate: new Date('2016-08-29T00:00:01'), // TODO: Cover Zählerwechselszenario: startDate !== startReading.time (relyOnMeterReading)
    startReading: {
      time: new Date('2017-08-29T00:00:01').getTime(),
      value: Math.floor(10526.411), // Math.round(10526,411),      //  10526,4110000 Wh
      unit: 'watthours', // IMPORTANT: should allways be in 'watthours' w/ multiplier = 1
      multiplier: 1
    },
    endDate: undefined, // new Date('9999-12-31T23:59:59')
    endReading: undefined,
    invoicingPeriod: { value: 365, multiplier: 1, unit: 'days' }, // (365*86400000 ms) IMPORTANT: should allways be in 'days' w/ multiplier = 1
    consumptionEstimate: {
      value: 1480 * 1000,
      multiplier: 1,
      unit: 'watthours',
      unitDivisor: 'per 365 days'
    }, // IMPORTANT: should allways be in 'watthours' w/ multiplier = 1
    currentReading: {
      time: new Date('2017-09-30T23:59:58').getTime(),
      value: Math.floor(98057.021),
      unit: 'watthours', //  IMPORTANT: should allways be in 'watthours' w/ multiplier = 1
      multiplier: 1
    }
  }
  // {
  //   salesPartner: {
  //     uuid: 'demo',
  //     rate: {
  //       energy: {
  //         value: 1,
  //         multiplier: 1000,
  //         unit: 'cent per watthour)'
  //       },
  //       basicFee: {
  //         value: Math.round(365 * 1000 / getDaysInYear((new Date()).getFullYear())),
  //         multiplier: 1000,
  //         unit: 'eurocent per day'
  //       }
  //     }
  //   },
  //   customer: {
  //     uuid: '3990'
  //   },
  //   orderNumber: '1888',
  //   contractAccount: {
  //     uuid: '66332211',
  //     type: 'Strom'
  //   },
  //   contract: {
  //     uuid: '99887766'
  //   },
  //   meterpoint: {
  //     number: '60668720',
  //     address: undefined
  //   },
  //   startDate: new Date('2017-01-25T12:27:22'),
  //   startReading: {
  //     time: new Date('2017-01-25T12:27:22').getTime(),
  //     value: 5398140000,
  //     unit: 'watthours',
  //     multiplier: 1000
  //   },
  //   endDate: undefined, // new Date('9999-12-31T23:59:59')
  //   endReading: undefined,
  //   invoicingPeriod: { value: 365, multiplier: 1, unit: 'days' }, // 365*86400000 ms
  //   consumptionEstimate: { value: (3650*1000)*1000, multiplier: 1000, unit: 'watthours'},
  //   currentReading: {
  //     time: undefined,
  //     value: undefined,
  //     unit: undefined, // 'watthours',
  //     multiplier: undefined //1000
  //   }
  // }
]

/*
  1. iterate through dataSet
  2. instanciate appropiate counterNodes on each contract record
  3. alllow nodes to write into root ledger
  4. reference sales partner entitlement account address in counterNode role lookup
  5. calc entitlements for record at hand
  6 look up current counter reading.
  7 create txMaterial
  8. make tx from counterNode => tenantId::entitlement account on root ledger
  9. if Tx went through, dial up the counter to new value, rinse reapeat
  Note one entitlement counter node for retention and one for energy per contract account record.
*/

/* intitalise rootnode */

// const node = new fury.Node({
//   external_id: 'sevtest::rootnode', // 0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E
//   privateKey: app.rootnode.privateKey || undefined,
//   testMode: true
// })

const node = () => createNode('sevtest::rootnode', app.rootnode.privateKey)

console.log('---- rootnode -----')
console.log(node().wallet.address)
console.log('---- rootnode -----')

function createTestRun () {
  /* read meter => calc entitlement => createTxMaterial */
  let arr = dataSet.map(o => {
    return function () {
      return getCurrentReading(o)
        .then(reading => {
          o.currentReading.time = o.meterpoint.address
            ? reading.time.toNumber() * 1000
            : reading.time // turn time from seconds to milliseconds
          // Note: if reading comes from blockchain reading.power needs to by divided
          // by 1000 to arrive at the Wh value.
          o.currentReading.value = o.meterpoint.address
            ? Math.round(reading.power.toNumber() / 1000)
            : reading.value
          o.currentReading.multiplier = reading.multiplier || 1
          o.currentReading.unit = reading.unit || 'watthours'
          console.log(o.startReading)
          console.log(o.currentReading)
        })
        .then(() => {
          return calcEntitlement(o)
        })
        .then(entObj => {
          return createTxMaterial(
            o.salesPartner.uuid,
            o.meterpoint.number,
            entObj
          )
        })
        .catch(err => console.error(err))
    }
  })

  serialPromise(arr).then(console.log.bind(console))
}
// var buf = crypto.randomBytes(4).toString('hex')
// console.info('buf')
// console.log(buf)
// console.log(buf.toString('hex'))

/* Functions */

function getCurrentReading (o) {
  if (o.meterpoint.address) {
    return fetchMeterpointReading(o.meterpoint.address)
      .then(reading => {
        console.info('new reading from ', o.meterpoint.address)
        return reading
      })
      .catch(err => console.error('getCurrentReading: ', err))
  }

  if (!o.meterpoint.address) {
    return new Promise((resolve, reject) => {
      if (
        !o.currentReading.time ||
        !o.currentReading.value ||
        !o.currentReading.multiplier ||
        o.currentReading.unit !== 'watthours'
      ) {
        console.warn('o.currentReading is not well formarted.')
      }
      resolve(o.currentReading)
    })
  }
}

/**
 * function fetchMeterPointReading
 */
function fetchMeterpointReading (meterpointAddress, n) {
  if (!n) n = node()
  return n.mpr().then(mpr => {
    return mpr.readings(meterpointAddress)
  })
}

function storeMeterpointReading (n, uint256) {
  return n.mpr().then(mpr => {
    return mpr.storeReading(uint256)
  })
}

/**
 * function fetchAccountHaben
 */
function fetchAccountHaben (ledgerAddress, accountAddress, n) {
  if (!n) n = node()
  return n.stromkonto(ledgerAddress).then(ledger => {
    return ledger.balancesHaben(accountAddress)
  })
}

/**
 * function fetchAccountSoll
 */
function fetchAccountSoll (ledgerAddress, accountAddress, n) {
  if (!n) n = node()
  return n.stromkonto(ledgerAddress).then(ledger => {
    return ledger.balancesSoll(accountAddress)
  })
}

/**
 * function addTx
 */
function addTx (n, ledgerAddress, fromAccount, toAccount, txValue, txBase) {
  return n.stromkonto(ledgerAddress).then(sko => {
    return sko.addTx(fromAccount, toAccount, txValue, txBase)
  })
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

  const timeNow = () => Date.now()
  const energy = {}
  const period = {}
  const entitlement = {}

  /* caltulate total energy */
  energy.metered = {}
  energy.metered.multiplier = o.currentReading.multiplier
  energy.metered.unit = o.currentReading.unit
  energy.metered.value = o.currentReading.value
    ? o.currentReading.value - o.startReading.value
    : 0

  energy.anticipated = {}
  energy.anticipated.multiplier =
    o.consumptionEstimate.multiplier / o.invoicingPeriod.multiplier
  energy.anticipated.unit = o.consumptionEstimate.unit
  energy.anticipated.value = o.currentReading.value
    ? Math.round(
      (timeNow() - o.currentReading.time) /
          86400000 *
          (o.consumptionEstimate.value / o.invoicingPeriod.value)
    ) // days * (wh/day)
    : Math.round(
      (timeNow() - o.startReading.time) /
          86400000 *
          (o.consumptionEstimate.value / o.invoicingPeriod.value)
    ) // days * (wh/day)

  console.assert(
    o.currentReading.value
      ? o.currentReading.value - o.startReading.value
      : energy.metered.value === 0,
    'reading check'
  )
  console.info(
    'metered energy: ',
    Math.round(energy.metered.value / energy.metered.multiplier),
    ' ',
    energy.metered.unit
  )
  console.info(
    'anticipated energy: ',
    Math.round(energy.anticipated.value / energy.anticipated.multiplier),
    ' ',
    energy.anticipated.unit
  )
  console.info(
    'sum: ',
    Math.round(
      (energy.metered.value + energy.anticipated.value) /
        energy.anticipated.multiplier
    )
  )

  /* calc total period */
  period.metered = {}
  period.metered.multiplier = 1
  period.metered.unit = 'days'
  period.metered.value = o.currentReading.time
    ? Math.floor((o.currentReading.time - o.startReading.time) / 86400000) *
      period.metered.multiplier // millisec to days rounded down * 1000
    : 0

  period.anticipated = {}
  period.anticipated.multiplier = 1
  period.anticipated.unit = 'days'
  period.anticipated.value = o.currentReading.time
    ? Math.floor((timeNow() - o.currentReading.time) / 86400000) *
      period.anticipated.multiplier // millisec to days rounded down * 1000
    : Math.floor((timeNow() - o.startReading.time) / 86400000) *
      period.anticipated.multiplier

  console.info(
    'metered period: ',
    period.metered.value / period.metered.multiplier,
    ' ',
    period.metered.unit
  )
  console.info(
    'calculated period: ',
    period.anticipated.value / period.anticipated.multiplier,
    ' ',
    period.anticipated.unit
  )
  console.info(
    'sum: ',
    (period.metered.value + period.anticipated.value) /
      period.anticipated.multiplier
  )

  /* Calc entitlement for energy sold */

  if (
    energy.metered.multiplier !== energy.anticipated.multiplier ||
    energy.metered.unit !== energy.anticipated.unit
  ) {
    console.warn(
      'energy multipliers und units must be the same! (should be 1000 and "watthours")'
    )
  }

  entitlement.energy = {}
  entitlement.energy.rate = o.salesPartner.rate.energy
  entitlement.energy.base =
    energy.metered.multiplier === energy.anticipated.multiplier &&
    energy.metered.unit === energy.anticipated.unit
      ? energy.metered
      : undefined
  entitlement.energy.base.value += energy.anticipated.value

  entitlement.energy.multiplier =
    entitlement.energy.base.multiplier * entitlement.energy.rate.multiplier
  entitlement.energy.unit = 'eurocent'
  entitlement.energy.value =
    entitlement.energy.base.value * entitlement.energy.rate.value

  /* Calc entitlement for contract duration period */

  if (
    period.metered.multiplier !== period.anticipated.multiplier ||
    period.metered.unit !== period.anticipated.unit
  ) {
    console.warn(
      'period multipliers und units must be the same! (should be 1000 and "days")'
    )
  }

  entitlement.period = {}
  entitlement.period.rate = o.salesPartner.rate.basicFee
  entitlement.period.base =
    period.metered.multiplier === period.anticipated.multiplier &&
    period.metered.unit === period.anticipated.unit
      ? period.anticipated
      : undefined
  entitlement.period.base.value += period.metered.value

  entitlement.period.multiplier =
    entitlement.period.base.multiplier * entitlement.period.rate.multiplier
  entitlement.period.unit = 'eurocent'
  entitlement.period.value =
    entitlement.period.base.value * entitlement.period.rate.value

  console.info('sucess! Entitlement calculation done.')
  console.info(entitlement)
  return entitlement
}

/**
 * function createTxMaterial
 */
function createTxMaterial (salesPartnerId, meterId, entitlementObj) {
  let energyCounter = () =>
    createNode(namespace(meterId + '-energy', app.rootnode.tenantId))
  let retentionCounter = () =>
    createNode(namespace(meterId + '-duration', app.rootnode.tenantId))
  let salesPartnerEntitlementAccountAddress = createNode(
    namespace('entitlement', salesPartnerId)
  ).wallet.address
  let txEnergy = entitlementObj.energy
  let txPeriod = entitlementObj.period

  txEnergy.fromAddress = energyCounter().wallet.address
  txEnergy.toAddress = salesPartnerEntitlementAccountAddress
  txPeriod.fromAddress = retentionCounter().wallet.address
  txPeriod.toAddress = salesPartnerEntitlementAccountAddress

  return (
    getRelation(node().wallet.address, 42, node())
      .then(rootledger => {
        let ledger
        if (rootledger === '0x0000000000000000000000000000000000000000') {
          console.warn('No rootledger on rootnode: ', node().wallet.address)
          return createLedger(node).then(newRootledger => {
            ledger = newRootledger
          })
        } else {
          ledger = rootledger
        }
        txEnergy.ledger = rootledger
        txPeriod.ledger = rootledger
      })
      .then(ledger => {
        console.log('ledgerAddress: ', ledger)
        console.log('   txEnergy    ', txEnergy)
        console.log('   txPeriod    ', txPeriod)
        // veryfy Counter bootstrap
        return serialPromise([
          // check if counter references ledger
          () =>
            getRelation(txEnergy.fromAddress, 42).then(address => {
              if (address === '0x0000000000000000000000000000000000000000') {
                // add counter1 as sender to rootledger
                return addSenderToLedger(
                  node(),
                  txEnergy.fromAddress,
                  txEnergy.ledger
                )
                  .then(() => {
                    // reference rootledger at counter roleLookup register 42
                    return setRelation(energyCounter(), 42, txEnergy.ledger)
                  })
                  .then(() => {
                    // reference salesPartner entitlement account at counter roleLookup register 43
                    return setRelation(
                      energyCounter(),
                      43,
                      salesPartnerEntitlementAccountAddress
                    )
                  })
              }
            }),
          // check if counter2 references ledger
          () =>
            getRelation(txPeriod.fromAddress, 42).then(address => {
              if (address === '0x0000000000000000000000000000000000000000') {
                // add counter as sender to rootledger
                return addSenderToLedger(
                  node(),
                  txPeriod.fromAddress,
                  txEnergy.ledger
                )
                  .then(() => {
                    // reference rootledger at counter roleLookup register 42
                    return setRelation(retentionCounter(), 42, txEnergy.ledger)
                  })
                  .then(() => {
                    // reference salesPartner entitlement account at counter roleLookup register 43
                    return setRelation(
                      retentionCounter(),
                      43,
                      salesPartnerEntitlementAccountAddress
                    )
                  })
              }
            })
        ])
      })
      /* .then(() => {
      return energyCounter().mpr()
        .then(mpr => {
          return mpr.storeReading(100)
        })
    }) */
      .then(() => {
        return Promise.all([
          fetchMeterpointReading(txEnergy.fromAddress).then(reading => {
            console.log('energyCounter reading: ')
            console.log('reading time:  ', reading.time.toNumber())
            console.log('reading power:  ', reading.power.toNumber())

            txEnergy.base.value -= reading.power.toNumber()
            txEnergy.value = txEnergy.base.value * txEnergy.rate.value
            console.log(txEnergy)
            if (txEnergy.value < 100000) return 'energy skiped'
            return addTx(
              energyCounter(),
              txEnergy.ledger,
              txEnergy.fromAddress,
              txEnergy.toAddress,
              txEnergy.value,
              txEnergy.base.value
            ).then(tx => {
              console.log(tx)
              return storeMeterpointReading(
                energyCounter(),
                reading.power.toNumber() + txEnergy.base.value
              )
            })
          }),
          fetchMeterpointReading(txPeriod.fromAddress).then(reading => {
            console.log('retentionCounter reading: ')
            console.log('reading time:  ', reading.time.toNumber())
            console.log('reading days:  ', reading.power.toNumber())
            txPeriod.base.value -= reading.power.toNumber()
            txPeriod.value = txPeriod.base.value * txPeriod.rate.value
            console.log('txPeriod   ', txPeriod)

            if (txPeriod.value < 100000) return 'Retention skiped'
            return addTx(
              retentionCounter(),
              txPeriod.ledger,
              txPeriod.fromAddress,
              txPeriod.toAddress,
              txPeriod.value,
              txPeriod.base.value
            ).then(tx => {
              console.log(tx)
              return storeMeterpointReading(
                retentionCounter(),
                reading.power.toNumber() + txPeriod.base.value
              )
            })
          })
        ])
      })
      // .then(() => {
      //   return fetchAccountSoll(txLedgerAddress, txPeriod.fromAddress, node)
      //     .then(onChainEntitlement => {
      //       // onChainEntitlement = 130000000
      //       txPeriod.value = (txPeriod.value - onChainEntitlement) > 0 ? txPeriod.value - onChainEntitlement : 0
      //       txPeriod.base.value = Math.round(txPeriod.value / txPeriod.rate.value)
      //       console.log('txPeriod:  ', txPeriod)
      //     })
      // })
      // .then(() => {
      //   console.log(txEnergy.fromAddress)
      //   return fetchAccountSoll(txLedgerAddress, txEnergy.fromAddress, node)
      //     .then(onChainEntitlement => {
      //       txEnergy.value = (entitlementObj.energy.value - onChainEntitlement) > 0 ? entitlementObj.energy.value - onChainEntitlement : 0
      //       txEnergy.base.value = Math.round(txEnergy.value / entitlementObj.energy.rate.value)
      //       console.log('txEnergy:  ', txEnergy)
      //     })
      // })
      // .then(() => {
      //   console.log('----Ledger----')
      //   console.log(txLedgerAddress)
      //   console.log('----txPeriod----')
      //   console.log(txPeriod)
      //   console.log('----txEnergy----')
      //   console.log(txEnergy)
      // })
      .catch(err => console.error(err))
  )
}

/**
 * function createLedger
 *
 *  creates ledger with node, adds ledger address to role 42
 */
function createLedger (n, overwriteExisting) {
  console.info('creating ledger for ', n.wallet.address)
  return n
    .stromkontoproxyfactory()
    .then(skpf => {
      return skpf.build()
    })
    .then(ledgerAddress => {
      setRelation(n, 42, ledgerAddress, overwriteExisting)
      return ledgerAddress
    })
    .catch(err => console.error(err))
}

/**
 * function addSenderToLedger
 */
function addSenderToLedger (n, senderAddress, ledgerAddress) {
  return n
    .stromkontoproxy(ledgerAddress)
    .then(ledger => {
      return ledger.modifySender(senderAddress, true)
    })
    .then(tx => {
      console.info(
        'added address ',
        senderAddress,
        ' as sender to ledger ',
        ledgerAddress
      )
      return ledgerAddress
    })
    .catch(err => console.error(err, 'something is wrong'))
}

/**
 * function fetchTxAddress
 */
function fetchTxAddress (n, namespacedStrg, createNew) {
  return getRelation(
    n.wallet.address,
    hash(namespacedStrg),
    n
  ).then(address => {
    if (
      address === '0x0000000000000000000000000000000000000000' ||
      createNew === true
    ) {
      // let cNode = new fury.Node({ external_id: namespacedStrg, testMode: true })
      let cNode = ethers.Wallet.createRandom()
      // let cNode = createNodeKeys(namespacedStrg, fury)
      console.log('node address:', node.wallet.address)
      console.log('cNode address: ', cNode.address)
      return setRelation(
        n,
        hash(namespacedStrg),
        cNode.address,
        createNew
      ).then(() => getRelation(n.wallet.address, hash(namespacedStrg)))
    } else {
      console.log(
        'Will not overwrite existing roleLookup relation pointer at',
        hash(namespacedStrg)
      )
      return address
    }
  })
}

/**
 * function createNode
 */
function createNode (extid, privateKey) {
  return new fury.Node({
    external_id: extid,
    privateKey: privateKey || undefined,
    rpc: 'https://fury.network/rpc',
    abilocation:
      'https://unpkg.com/stromdao-businessobject@0.5.17/smart_contracts/',
    testMode: true
  })
}

/**
 * function namespace
 */
function namespace (strg, tenantId, appendYear) {
  // let app = app.appId ? app.appId + '::' : ''
  let tenant = tenantId ? tenantId + '::' : ''
  let year = appendYear ? '::' + new Date().getFullYear() : ''

  return tenant + strg + year
}

/**
 * function getRelation
 */
function getRelation (address, key, n) {
  // (0x0000, 93401849032184, => 0x000
  if (!n) {
    n = node()
  }
  return n
    .roleLookup()
    .then(rl => {
      return rl.relations(address, key)
    })
    .then(res => {
      console.info(
        'roleLookup relation ',
        key,
        ' of ',
        address,
        ' points to ',
        res
      )
      return res
    })
    .catch(err => console.error(err))
}

/**
 * function setRelation
 */
function setRelation (n, key, toAddress, overwriteExisting) {
  return n
    .roleLookup()
    .then(rl => {
      return rl.relations(n.wallet.address, key)
    })
    .then(lookedupAddress => {
      if (
        lookedupAddress === '0x0000000000000000000000000000000000000000' ||
        overwriteExisting === true
      ) {
        console.info(
          'setting role lookup relation',
          key,
          ' of ',
          n.wallet.address,
          ' to ',
          toAddress
        )
        return n.roleLookup().then(rl => {
          return rl.setRelation(key, toAddress)
        })
      } else {
        console.warn(
          'Role lookup relation ',
          key,
          'already exists: ',
          lookedupAddress
        )
        console.warn('will not overwrite existing')
        return undefined
      }
    })
    .catch(err => console.error(err))
}

/**
 * function getDaysInYear
 */
function getDaysInYear (year) {
  return isLeapYear(year) ? 366 : 365
}

/**
 * function isLeapYear
 */
function isLeapYear (year) {
  return year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)
}

/**
 * function serialPromise
 *
 * executes Promises sequentially.
 *
 * @param {funcs} An array of functions (funcs) that each return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 *
 * via https://stackoverflow.com/questions/24586110
 */
// const serialPromise = funcs =>
//     funcs.reduce((promise, func) =>
//         promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]))

function serialPromise (funcs) {
  return funcs.reduce((promise, func) => {
    return promise.then(result => {
      return func().then(Array.prototype.concat.bind(result))
    })
  }, Promise.resolve([]))
}

/**
 * function hash
 */
function hash (strg) {
  return Math.abs(djb(strg))
}

module.exports = { createTestRun, calcEntitlement }
