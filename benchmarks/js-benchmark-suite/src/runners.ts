import { sleep } from './util'

// Converts a string describing a frequency to a number representing the
// milliseconds elapsed with the given frequency between two events
function convertFrequency(freq: string): number {
  if (freq === 'instant') return 0
  const [t, timeFrame] = freq.split(' per ')
  const T: number = parseInt(t)
  if (T === 0 || !T) {
    throw Error(`Could not parse frequency "${freq}" or frequency of 0`)
  }

  switch (timeFrame) {
    case 'minute':
      return Math.round(60 * 1000 / T)
    case 'second':
      return Math.round(1000 / T)
    default:
      throw Error(`Frequency "${freq}" is not a valid frequency value`)
  }
}

const debugMode = process.env.RUNNERS_DEBUG_MODE || false

type LoggingFunction = (s: string) => void

export interface PerformanceReport {
  describe(logger: LoggingFunction): void
}

export interface PerformanceRunner {
  name: string
  runPerformance(dsClient: object, options: object): Promise<PerformanceReport>
  describeRunner(logger: LoggingFunction): void
}

function makeSimpleReport(what: string): PerformanceReport {
  return {
    describe: (logger: LoggingFunction) => logger(what)
  }
}

function dsUtilsLogin(dsUtils: any, options: object) {
  const ds = new dsUtils(options)
  ds.initClient()
  return ds.login().then(() => ds)
}

function logData<T>(logger: LoggingFunction, data: any | Array<T>, key: string = '', prefix: string = ''): void {
  if (data instanceof Array) {
    logger(`${prefix}${key} = [`)
    for (const item of data) {
      logData(logger, item, '', `${prefix}   `)
    }
    logger(`${prefix}]`)
  } else if (data instanceof Object) {
    logger(`${prefix}${key} = {`)
    Object.keys(data).map(key => {
      logData(logger, data[key], key, `${prefix}   `)
    })
    logger(`${prefix}}`)
  } else {
    const varName = key ? `${key}: ${typeof data} = ` : ''
    logger(`${prefix}${varName}${data}`)
  }
}

interface EventHandler {
  handleEvent(o: any): void
}

class EventDiscarder implements EventHandler {
  handleEvent(o: any) {}
}

class EventPrinter implements EventHandler {
  handleEvent(o: any) {
    const loggingF = (s: string) => console.log('EventPrinter |>'.padEnd(20), s)
    logData(loggingF, o, 'eventData')
  }
}

function getEventHandler(name: string): EventHandler {
  switch(name) {
    case 'print-data':
      return new EventPrinter()
    case 'discard':
      return new EventDiscarder()
  }
  throw Error(`Could not find event handler for "${name}"`)
}

// ---

export class SingleUserEventEmitter implements PerformanceRunner {
  public name: string
  public cooldownInMs: number
  public waitAtStartInMs: number
  public eventName: string
  public data: any
  public timeoutInMs: number

  constructor(o: any) {
    this.name = o.name
    this.cooldownInMs = convertFrequency(o.frequency)
    this.eventName = o.event
    this.data = o.data
    this.timeoutInMs = parseInt(o['timeout-ms'])
    this.waitAtStartInMs = parseInt(o['wait-at-start-ms'])
  }

  public async runPerformance(dsUtils: object, options: object) {
    if (this.waitAtStartInMs) {
      await sleep(this.waitAtStartInMs)
    }
    const ds = await dsUtilsLogin(dsUtils, options)
    const startTime = Date.now()
    let counter = 0
    while (startTime + this.timeoutInMs > Date.now()) {
      counter++
      ds.client.event.emit(this.eventName, this.data)
      if (this.cooldownInMs > 0) {
        await sleep(this.cooldownInMs)
      }
    }
    ds.client.close()
    return makeSimpleReport(`Single User Event Emitter - Finished ${counter} event emits`)
  }

  public describeRunner(logger: LoggingFunction) {
    logger('Single User Event Emitter')
    logger('')
    logger('Creates a single client that emits event at a regular pace')
    if (debugMode) {
      logData(logger, this, 'data')
    }
  }
}

// ---

export class SingleUserSubscriber implements PerformanceRunner {
  public name: string
  public eventName: string
  public onEventName: string
  public timeoutInMs: number

  constructor(o: any) {
    this.name = o.name
    this.eventName = o.event
    this.onEventName = o['on-event']
    this.timeoutInMs = parseInt(o['timeout-ms'])
  }

  public async runPerformance(dsClient: object, options: object) {
    const ds = await dsUtilsLogin(dsClient, options)
    const eventHandler = getEventHandler(this.onEventName)
    let counter = 0

    ds.client.event.subscribe(this.eventName, (data: any) => {
      counter++
      eventHandler.handleEvent(data)
    })

    await sleep(this.timeoutInMs)
    ds.client.close()
    return makeSimpleReport(`Single User Subscriber - Counted ${counter} emitted events`)
  }

  public describeRunner(logger: LoggingFunction) {
    logger('Single User Subscriber')
    logger('')
    logger('Creates a single client that subscribes to an event and does something with the')
    if (debugMode) {
      logData(logger, this, 'data')
    }
  }
}

// ---

export class ParallelUsersEmit implements PerformanceRunner {
  public name: string
  public numberOfUsers: number
  public eventName: string
  public cooldownInMs: number
  public waitAtStartTimeMs: number
  public timeoutInMs: number
  public data: any

  constructor(o: any) {
    this.name = o.name
    this.numberOfUsers = o.users
    this.eventName = o.event
    this.cooldownInMs = convertFrequency(o.frequency)
    this.data = o.data
    this.waitAtStartTimeMs = o['wait-at-start-ms']
    this.timeoutInMs = o['timeout-ms']
  }

  public async runPerformance(dsClient: object, options: object) {
    await sleep(this.waitAtStartTimeMs)

    // Create a list of users with size this.numberOfUsers that are logged in
    const userPromises = Array(this.numberOfUsers)
      .fill(0)
      .map(unused => dsUtilsLogin(dsClient, options))

    const users = []
    // Let all users log in
    for (const user of userPromises) {
      users.push(await user)
    }

    let counter = 0
    const startTime = Date.now()
    while (startTime + this.timeoutInMs > Date.now()) {
      // Here we just fire the events.
      users.map(user => user.client.event.emit(this.eventName, this.data))
      counter += this.numberOfUsers
      await sleep(this.cooldownInMs)
    }

    // It is done, exit with the clients
    users.map(user => user.close())

    return makeSimpleReport(`Parallel Users Emit - Created ${counter} events`)
  }

  public describeRunner(logger: LoggingFunction) {
    logger('Parallel Users Emit')
    logger('')
    logger('Creates several clients that emit to a single event at a given frequency')
    if (debugMode) {
      logData(logger, this, 'data')
    }
  }
}

// ---

export class OnAndOffSubscriber implements PerformanceRunner {
  public name: string
  public eventName: string
  public onEventName: string
  public cooldownInMs: number
  public waitAtStartMs: number
  public timeoutInMs: number

  constructor(o: any) {
    this.name = o.name
    this.eventName = o.event
    this.onEventName = o['on-event']
    this.cooldownInMs = convertFrequency(o.frequency)
    this.waitAtStartMs = parseInt(o['wait-at-start-ms'])
    this.timeoutInMs = parseInt(o['timeout-ms'])
  }

  public async runPerformance(dsClient: object, options: object) {
    const user = await dsUtilsLogin(dsClient, options)
    await sleep(this.waitAtStartMs)

    let counter = 0
    const handler = getEventHandler(this.onEventName).handleEvent
    const startTime = Date.now()
    while (startTime + this.timeoutInMs > Date.now()) {
      user.client.event.subscribe(this.eventName, handler)
      await sleep(this.timeoutInMs)
      user.client.event.unsubscribe(this.eventName, handler)
      await sleep(this.timeoutInMs)
      counter++
    }
    user.close()
    return makeSimpleReport(`Subscribed and unsubscribed ${counter} times`)
  }

  public describeRunner(logger: LoggingFunction) {
    logger('On And Off Subscriber')
    logger('')
    logger('Creates a subscriber that repeatedly subscribes and unsubscribes')
    if (debugMode) {
      logData(logger, this, 'data')
    }
  }
}

export class EmptyRunner implements PerformanceRunner {
  public name: string

  // TODO: Throw anywhere here?
  constructor(o: any) {
    this.name = 'empty'
  }

  public async runPerformance(dsClient: object, options: object) {
    return makeSimpleReport('empty')
  }

  public describeRunner(logger: LoggingFunction) {
    logger('Empty')
  }
}

export function createRunner(o: any): PerformanceRunner {
  switch(o['type']) {
    case 'single-user-event-emitter':
      return new SingleUserEventEmitter(o)
    case 'single-user-subscriber':
      return new SingleUserSubscriber(o)
    case 'parallel-users-emit':
      return new ParallelUsersEmit(o)
    case 'on-and-off-subscriber':
      return new OnAndOffSubscriber(o)
    default:
      return new EmptyRunner(o)
  }
}

