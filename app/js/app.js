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
          value: 3,
          multiplier: 1000,
          unit: 'cent per watthour)'
        },
        basicFee: {
          value: Math.round(
            730 * 1000 / getDaysInYear(new Date().getFullYear())
          ),
          multiplier: 1000,
          unit: 'eurocent per day'
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
      number: '60668720',
      address: '0xEAA8789b2f942d66A880731ffFD24f56E87Cf809' // Stefan's meter, TODO: Meter number etc.
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
      value: 1188 * 1000 * 1000,
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

/* intitalise rootnode */

const node = new fury.Node({
  external_id: 'sevtest::rootnode',
  privateKey: app.rootnode.privateKey || undefined,
  testMode: true
})
console.log('---- rootnode -----')
console.log(node.wallet.address)
console.log('---- rootnode -----')

function createTestRun () {
  let arr = dataSet.map(o => {
    return function () {
      return getCurrentReading(o)
        .then(reading => {
          o.currentReading.time = o.meterpoint.address
            ? reading.time.toNumber() * 1000
            : reading.time // turn time from seconds to milliseconds
          o.currentReading.value = o.meterpoint.address
            ? reading.power.toNumber()
            : reading.value
          o.currentReading.multiplier = reading.multiplier || 1000
          o.currentReading.unit = reading.unit || 'watthours'
        })
        .then(() => {
          return calcEntitlement(o)
        })
        .then(enObj => {
          createTxMaterial(o, app.rootnode.tenantId, o.customer.uuid, enObj)
        })
        .catch(err => console.error(err))
    }
  })

  serialPromise(arr).then(console.log.bind(console))
}

/* Functions */

function getCurrentReading (o) {
  if (o.meterpoint.address) {
    return fetchMeterpointReading(o.meterpoint.address, node)
      .then(reading => {
        console.info('new reading from ', o.meterpoint.address, ': ', reading)
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
  if (!n) n = node
  return n.mpr().then(mpr => {
    return mpr.readings(meterpointAddress)
  })
}

/**
 * function fetchAccountHaben
 */
function fetchAccountHaben (ledgerAddress, accountAddress, n) {
  if (!n) n = node
  return n.stromkonto(ledgerAddress).then(ledger => {
    return ledger.balancesHaben(accountAddress)
  })
}

/**
 * function fetchAccountSoll
 */
function fetchAccountSoll (ledgerAddress, accountAddress, n) {
  if (!n) n = node
  return n.stromkonto(ledgerAddress).then(ledger => {
    return ledger.balancesSoll(accountAddress)
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

  const timeNow = Date.now()
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
          (o.consumptionEstimate.value / o.invoicingPeriod.value)
    ) // days * (wh/day)
  console.info(
    'metered energy: ',
    Math.round(energy.metered.value / energy.metered.multiplier),
    ' ',
    energy.metered.unit
  )
  console.info(
    'anticipated energy: ',
    Math.round(energy.inAdvance.value / energy.inAdvance.multiplier),
    ' ',
    energy.inAdvance.unit
  )
  console.info(
    'sum: ',
    Math.round(
      (energy.metered.value + energy.inAdvance.value) /
        energy.inAdvance.multiplier
    )
  )

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

  console.info(
    'metered period: ',
    period.metered.value / period.metered.multiplier,
    ' ',
    period.metered.unit
  )
  console.info(
    'calculated period: ',
    period.inAdvance.value / period.inAdvance.multiplier,
    ' ',
    period.inAdvance.unit
  )
  console.info(
    'sum: ',
    (period.metered.value + period.inAdvance.value) /
      period.inAdvance.multiplier
  )

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
  entitlement.energy.rate = o.salesPartner.rate.energy
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
  entitlement.period.rate = o.salesPartner.rate.basicFee
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
    entitlement.period.base.value * entitlement.period.rate.value

  console.info('sucess! Entitlement calculation done.')
  console.info(entitlement)
  return entitlement
}

/**
 * function createTxMaterial
 */
function createTxMaterial (o, tenantId, customerId, entitlementObj) {
  let txLedgerAddress = ''
  let txPeriod = {}
  let txEnergy = {}

  return (
    getRelation(node.wallet.address, 42, node)
      .then(rootledger => {
        if (rootledger === '0x0000000000000000000000000000000000000000') {
          return createLedger(node).then(newRootledger => {
            txLedgerAddress = newRootledger
          })
        } else {
          txLedgerAddress = rootledger
        }
      })
      .then(() => {
        let string = namespace(customerId + '-period', tenantId)
        console.info(string, ' => ', hash(string))
        return fetchTxAddress(node, string).then(fromAddress => {
          txPeriod.fromAddress = fromAddress
        })
      })
      .then(() => {
        return fetchTxAddress(
          node,
          namespace(customerId + '-energy', tenantId)
        ).then(fromAddress => {
          txEnergy.fromAddress = fromAddress
        })
      })
      .then(() => {
        console.log(namespace('entitlement', tenantId, true))
        return fetchTxAddress(
          node,
          namespace('entitlement', tenantId, true)
        ).then(toAddress => {
          txPeriod.toAddress = toAddress
          txEnergy.toAddress = toAddress
        })
      })
      .then(() => {
        console.log('ledgerAddress: ', txLedgerAddress)
        return fetchAccountSoll(
          txLedgerAddress,
          txPeriod.fromAddress,
          node
        ).then(onChainEntitlement => {
          txPeriod.value =
            entitlementObj.period.value - onChainEntitlement > 0
              ? entitlementObj.period.value - onChainEntitlement
              : 0
          txPeriod.base = Math.round(
            txPeriod.value /
              entitlementObj.period.rate.value /
              entitlementObj.period.base.multiplier
          )
          console.log('txPeriod:  ', txPeriod)
        })
      })
      .then(() => {
        console.log(txEnergy.fromAddress)
        return fetchAccountSoll(
          txLedgerAddress,
          txEnergy.fromAddress,
          node
        ).then(onChainEntitlement => {
          txEnergy.value =
            entitlementObj.energy.value - onChainEntitlement > 0
              ? entitlementObj.energy.value - onChainEntitlement
              : 0
          txEnergy.base = Math.round(
            txEnergy.value /
              entitlementObj.energy.rate.value /
              entitlementObj.energy.base.multiplier
          )
          console.log('txEnergy:  ', txEnergy)
        })
      })
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
    n = node
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
