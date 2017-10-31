import test from 'ava'
const sinon = require('sinon')
const app = require('../app/js/app.js')

test('calcEntitlement', t => {
  const dataSet = {
    salesPartner: {
      uuid: 'rakentenstom',
      rate: {
        energy: {
          value: 3,
          multiplier: 1000,
          unit: 'cent per watthour)'
        },
        basicFee: {
          value: Math.round(730 * 1000 / 365),
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
      time: 1509189314000,
      value: 200386000,
      unit: 'watthours',
      multiplier: 1000
    }
  }

  sinon.stub(Date, 'now')
  Date.now.returns(1509189487666)

  const response = {
    energy: {
      rate: { value: 3, multiplier: 1000, unit: 'cent per watthour)' },
      base: { multiplier: 1000, unit: 'watthours', value: 199977151 },
      multiplier: 1000000,
      unit: 'eurocent',
      value: 599931453
    },
    period: {
      rate: { value: 2000, multiplier: 1000, unit: 'eurocent per day' },
      base: { multiplier: 1000, unit: 'days', value: 63000 },
      multiplier: 1000000,
      unit: 'eurocent',
      value: 126000000
    }
  }

  t.deepEqual(app.calcEntitlement(dataSet), response)
})
