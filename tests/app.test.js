import test from 'ava'
const sinon = require('sinon')
const app = require('../app/js/app.js')

test('calcEntitlement', t => {
  const dataSet = {
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
          value: 200000,
          multiplier: 100000,
          unit: 'eurocent',
          unitDivisor: 'per day'
        }
      }
    },
    customer: { uuid: '30091981' },
    orderNumber: '10005277',
    contractAccount: { uuid: '20050466', type: 'Strom' },
    contract: { uuid: '5000161171' },
    meterpoint: { number: '60668720' },
    startDate: '2016-08-29T00:00:01.000Z',
    startReading: {
      time: 1503964801000,
      value: 10526,
      unit: 'watthours',
      multiplier: 1
    },
    invoicingPeriod: { value: 365, multiplier: 1, unit: 'days' },
    consumptionEstimate: {
      value: 1480000,
      multiplier: 1,
      unit: 'watthours',
      unitDivisor: 'per 365 days'
    },
    currentReading: {
      time: 1506815998000,
      value: 98057,
      unit: 'watthours',
      multiplier: 1
    }
  }

  sinon.stub(Date, 'now')
  Date.now.returns(1509984976429)

  const response = {
    energy: {
      rate: {
        value: 300,
        multiplier: 100000,
        unit: 'eurocent',
        unitDivisor: 'per watthour'
      },
      base: { multiplier: 1, unit: 'watthours', value: 236253 },
      multiplier: 100000,
      unit: 'eurocent',
      value: 70875900
    },
    period: {
      rate: {
        value: 200000,
        multiplier: 100000,
        unit: 'eurocent',
        unitDivisor: 'per day'
      },
      base: { multiplier: 1, unit: 'days', value: 68 },
      multiplier: 100000,
      unit: 'eurocent',
      value: 13600000
    }
  }

  t.deepEqual(app.calcEntitlement(dataSet), response)
})
