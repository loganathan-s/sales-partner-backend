## CSV Parsing
[todo]

## Rootnode operation

The app rootnode runs automatically on a webserver. It is the client wallet that performs sales partner entitlement calculations on behalf of the root tenant. 

### Rootnode instantiation

Rootnotes are be instanciated via a private key to ensure compatiblity across different runtime environments:

```js
const fury = require('stromdao-businessobject')

const node = new fury.Node({
  external_id: 'app-rootnode',
  privateKey: process.env.THEKEY,
  testMode: true,
  rpc: 'https://fury.network/rpc',
  abilocation: 'https://unpkg.com/stromdao-businessobject/smart_contracts/'
})
```

Note: Use Environment variables to  [keep your secrets secret](https://medium.com/ibm-watson-data-lab/environment-variables-or-keeping-your-secrets-secret-in-a-node-js-app-99019dfff716)

### The data set

The app will iterate through an array of contract records, a. k. a the data set. The data set is derived from an external csv file on a daily basis. [_**TODO**: The csv import and parsing has still to be implemented_.]

Each contract records contains information on a specific customer energy delivery contract account. The most important record attributes are:

```js
  salesPartner.uuid, // a. k. a. sales partner Id or tenant Id
  salesPartner.rate  // the rates to calculate sales partner commission entitlement for the record / contract at hand
  contractAccount.uuid // a unique identifier within each data set record that referenced the contract account for of an end customer.
  meterpoint // information that identifies the end customer's meterpoint
  startDate // JavaScript Data Object specifiying the contract effective date
  startReading // Thr initial meterpoint reading. Will usually reference the meter reading for the contract effective date.
  endDate // JavaScript Data Object specifiying the contract termination date, if not specified the value should be 9999-12-31T23:59:59 or undefined
  endReading // final meter reading for a terminated contract account
  invoicingPeriod // specifies duration of a invoicing period in days. Default: 365 days
  consumptionEstimate // estimated consumption during invoicing period in watthours
  currentRading // Meter reading object of the latest available meter reading
```

### Data formating

Data set records are plain JavaScript Objects. The following objects require specific attributes and formating:

#### Quantity object

A quantity object sepecifies a quantity of something. It has three required properties: (1) a `qty.value` that describes the quantity amount, (2) a `qty.unit` that specifies the quantity unit and (3) a `qty.multiplier` in order to avoid floating point operations when working with values that represent only a fraction of a given unit.

The Sales Partner application trades mainly in two distinct quantities: (1) duration in days and (2) energy or power in watthours:

```js
let duration = { value: 67, unit: 'days', multiplier: 1 }
let power = { value: 215383, unit: 'watthours', multiplier: 1}

```

If possible `muliplier` and `unit` porperties for a given quatity should be made consistent end-to-end throuout the entire application. Additional complexity by utilizing multipliers should be avoided.

#### Rate object (aka moeney)

A rate specifies the value of a given quantity or unit. Rates are utilized to calculate commission entitlements. 

Each rate object requires a range of properties to be specified: (1) The `rate.value` indicates the rate amount in Euro or eurocent, (2) A `rate.multiplier` to handle sub-cent micro-transaction, (3) a `rate.unit` string that specifies the currency per unit.  `rate.units` can come in different forms and shapes but usually default to 'eurocent per unit' throughout the application.

The Sales Partner application trades in two different rate categories: (1) a commission rate for the energy delivered to a customer and  (2) a rate based on how long the customer contract has been effective to date. These rates are specified for each contract rerord within the dataSet individually (e. g. `recordObj.salesPartner.rate`):

```js
/* exampe commission rate for energy */
let energyRate = {
  value: 300, 
  multiplier: 100000, 
  unit: 'eurocent per watthour)'
}

/* exampe commission rate for contract duration or customer retention */
let retentionRate = {
  value: 730,
  multiplier: 1, 
  unit: 'eurocent per year'
}
```
If possible `muliplier` and `unit` porperties should be made consistent end-to-end throuout the entire application. To achieve that with the example data above, we'd convert the `retentionRate` to `'eurocent per day'` and set its `multiplier` to `100000`:

```js
/* example rate multiplier conversion */
let oldMultiplier = retentionRate.multiplier
let newMultiplier = 100000
let newValue = retentionRate.value / oldMultiplier * newMultiplier

retentionRate.value = newValue
retentionRate.multiplier = newMultiplier

/* example rate unit conversion */
let newUnit = 'eurocent per day'
let newValuePerDay = retentionRate.value  / 365

retentionRate.value = newValuePerDay
retentionRate.unit = newUnit

```

#### Entitlement object

An entitlement is calculated by multipling a given quantity with a given rate. Both  qantity and rate need to be referenced within an entitlement object for increased transparency, whereby (1) the `entitlement.base` references the quantity object and (2) the `entitlement.rate` references the rate object used to derrive (3) the `entitlement.value` and (4) the `entitlement.muliplier`. (4) An `entitlement.unit` is additionally required to specify the exact currency of the entitlement value amount:

```js
let entitlement = {}

/* example sales partner entitlement for energy deliverd */
entitlement.energy = {
  value: 64614900,
  unit: 'eurocent',
  multiplier: 100000,
  rate: { value: 300, multiplier: 100000, unit: 'cent per watthour)' },
  base: { value: 215383, multiplier: 1, unit: 'watthours' },
}

/* example sales partner entitlement for customer retention */
entitlement.period = {
  value: 13400000,
  unit: 'eurocent',
  multiplier: 100000
  rate: { value: 200000, multiplier: 100000, unit: 'eurocent per day' },
  base: { multiplier: 1, unit: 'days', value: 67 },
}
```
Throughout the Sales Partner Application, entitlements default to `'eurocent'` units and and a multiplier value of `100000`.

#### meterpoint

A `meterpoint.number` is required for each contract record within the data set. An optional `meterpoint.address` attribute allows to retrieve the latest meterpoint reading information at runtime in order to perform entitlement calculation on the most up to date information.

```js
/* meterpoint formarting example */
meterpoint: {
  number: '39110300981', // required
  address: '0xEAA8789b2f942d66A880731ffFD24f56E87Cf809',  // optional
}
```

#### meterpoint readings

A meterpoint reading object provides (1) a `reading.time` timestamp in milliseconds and (2) the actual `reading.value` as an integer in watthours. (3) It also specifies a `reading.multiplier` property to handle sub-watthour micro-transactions. (4) The `reading.unit` is also specified in order to support readings in Kilo- or Megawatthours where appropiate. 
```js
/* reading object formating example */
let startReading: {
  time: 1503664042000, // Fri Aug 25 2017 14:27:22
  value: 415,
  unit: 'watthours',
  multiplier: 1
}
```

Note that the delta of two meterpoint readings results in a two quantity objects that specifz an amount of energy and a given time period:

```js
/* example of a second meterpoint reading */
let currentReading: {
  time: 1509535815000, // Wed Nov 01 2017 12:30:15
  value: 215971,
  unit: 'watthours',
  multiplier: 1
}

/* example of the resulting energy quantity object */
let powerQty = {
  value: currentReading.value - startReading.value // delta => 215556
  unit: 'watthours'
  multiplier: 1
}

/* example of the resulting duration quantity object */
let durationQty ={
  value: currentReading.time - startReading.time
  unit: 'milliseconds'
  multiplier: 1
}
```

#### Invoicing period & consumption estimates

Each data set record requires an `invoicingPeriod` property, that specifies the interval between two invoices that an end customer receives for the energy deliverd to her. The invoicing period is formated as a quantity object. The default is 365 days

```js 
/* invoicing period example */
invoicingPeriod: { value: 365, unit: 'days', multiplier: 1 }
```

The `consumptionEstimate` property represents the entimated energy consumption per  invoicing period of a given delivery contract or dataSet record.

```js
/* consumption estiomate example */
consumptionEstimate: { value: 1188, multiplier: 1, unit: 'kilowatthours per 365 days' }
```

`invoicingPeriod` and `consumptionEstimate` properties work in tandem to help derive estimated sales partner commission entitlements per data set record, when no meterpoint readings are present.

An example of this given the perod and estimate properties from above:

```js
/* convert the given consumption estimate to watthour per day */
consumptionEstimate.value = 1188 * 1000 / invoicingPeriod.value
consumptionEstimate.unit = 'watthours per day'

/* set a contract effective date as specified in each data set record */
let startDate = startDate: new Date('2017-08-25T12:27:22')

/* set a current date in oder to specify the period for the estimate */
let currentDate = new Date()

/* calculate the period to do the consumption estimate for */
let periodVal = startDate.getTime() - currentDate.getTime()

/* wrap the period value into a quantity object */
let period = {
  value: periodVal,
  unit: 'milliseconds'
  multiplier: 1
}

/* convert the period value and unit from milliseconds to days */
period.value /= 86400000 
period.unit = 'days'

/* calculate the energy consumption estimate for the given period */
let energyEstimate = {
  value: consumtionEstimate.value * period.value
  units: 'watthours'
  multiplier: consumtionEstimate.multiplier * period.multiplier
}

/* calculate the commission entitlement for the energy estimate given the folloing rate */
let rate = { value: 300, multiplier: 100000, unit: 'eurocent per watthour }

let entitlement = {
  value: energyEstimate.value * 
}

```


## Sales partner entitlement calculation
[TODO: document how entitlement calculation is done per dataSet record]
[TODO: document how `calcEntitlement function works]

## Entitlement submission
[TODO: document how convert entitlements to Blockchain transactions]
[TODO: document how submit entitlement transactions into the blockchain]
[TODO: document how createTxMaterial() fn works]

## App Bootstrapping

Setting up the sales partner applicaitin involves some initial bootstrapping of the rootnode.

### Rootnode credentials and key

Initially a private key needs to be created for the rootnode. The Business Object provides a convinient method to do so with a `username` and `password`

```js
const fury = require('stromdao-businessobject')

let rootnodePrivateKey = undefined

const rootnodeAccount = new fury.Account('your username', 'and password')

rootAccount.wallet()
  .then(w => {
    rootnodePrivateKey = w.privateKey
  })
```

Then initialize the rootnode with the private Key derived from the `fury.Account` method:

```js
const rootnode = new fury.Node({
  external_id: 'whatever',
  privateKey: rootnodePrivateKey
  rpc: 'https://fury.network/rpc',
  abilocation: 'https://unpkg.com/stromdao-businessobject/smart_contracts/',
  testMode: true
})
```
Note: Do not ever share your private key or credentials. Write it down and store it somewhere save.

During runtime the rootnode address and key are available by evoking the apprpiate properties on the `wallet` object of the rootnode instance. Check it out:

```js
/* derive the rootnode address and key */
let myRootnodeAddress = rootnode.wallet.address
let myRootnodePrivateKey = rootnode.wallet.privateKey

/* test it */
console.assert(myRootnodePrivateKey === rootnodePrivateKey)
```
The `rootnode.wallet.address` of the test app should equal `'0x43D9F5a7E0BCFd49c2B7078b9e39b17C0BA46F4E'`


### Root ledger

The rootnode requires a blockchain based bookkeeping ledger to keep track of commission entitlements, claims and settlements etc.

The rootnode instance can be utilized to create this ledger:

```js
const rootLedgerAddress = rootnode.stromkontoproxyfactory()
  .then(skpf => {
    return skpf.build()
  })
```
Once the ledger was established, its public address should be stored in a place where it can be easily discoverd by diffrent sales partners. Utilizing the roleLookup method of the rootnode instance is the recommended way to do that:

```js
rootnode.roleLookup()
  .then(rl => {
    return rl.setRelation(42, rootLedgerAddress)
  })
```
Note: The integer `42` is utilizes as the roleLookup register under which to store the ledger address. This is a general convention: a discoverable node ledger should be made available via `roleLookup` register `42` and nowhere else.

Ledger retrieval for a given node (e. g. the rootnode) can be achieved by evoking the appropiate `roleLookup` method:

```js
anynode.roleLookup()
  .then(rl => {
    return rl.relations(rootnode.wallet.address, 42)
  })
```
[Work in progress: there is more on app bootstraping]
