const createTestRun = function () {
  const fury = require('stromdao-businessobject')
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
            value: 1200 * 1000,
            multiplier: 1000,
            unit: 'cent per year'
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
        value: 1056 * 1000 * 1000,
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

  /* intitalise rootnode */

  const node = new fury.Node({
    privateKey: app.rootnode.privateKey || undefined,
    testMode: true
  })
  console.log('---- rootnode -----')
  console.log(node.wallet.address)
  console.log('---- rootnode -----')

  let arr = dataSet.map(o => {
    getCurrentReading(o)
      .then(reading => {
        o.currentReading.time = reading.time.toNumber() * 1000 // turn time from seconds to milliseconds
        o.currentReading.value = reading.power.toNumber()
        o.currentReading.multiplier = 1000
        o.currentReading.unit = 'watthours'
        console.info('current reading:')
      })
      .then(() => {
        let entitlement = calcEntitlement(o)
      })
  })

  /* Functions */

  function getCurrentReading (o) {
    if (o.meterpoint.address) {
      return fetchMeterpointReading(o.meterpoint.address, node)
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
          reject('o.currentReading is not well formarted. Skipping entry.')
        }
        resolve(o.currentReading)
      })
    }
  }

  function fetchMeterpointReading (meterpointAddress, n) {
    if (!n) n = node
    return n.mpr().then(mpr => {
      return mpr.readings(meterpointAddress)
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

    console.info(
      'metered energy: ',
      energy.metered.value / energy.metered.multiplier,
      ' ',
      energy.metered.unit
    )
    console.info(
      'anticipated energy: ',
      energy.inAdvance.value / energy.inAdvance.multiplier,
      ' ',
      energy.inAdvance.unit
    )
    console.info(
      'sum: ',
      (energy.metered.value + energy.inAdvance.value) /
        energy.inAdvance.multiplier
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
      entitlement.period.base.value *
      Math.round(
        entitlement.period.rate.value / getDaysInYear(new Date().getFullYear())
      )

    console.info('sucess! Entitlement calculation done.')
    console.info(entitlement)
    return entitlement
  }

  function getDaysInYear (year) {
    return isLeapYear(year) ? 366 : 365
  }

  function isLeapYear (year) {
    return year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)
  }
}
module.exports = createTestRun
