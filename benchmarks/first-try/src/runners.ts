// Converts a string describing a frequency to a number representing the
// milliseconds elapsed with the given frequency between two events
function convertFrequency(freq: string): number {
  return -1
}

const debugMode = process.env.RUNNERS_DEBUG_MODE || false

type LoggingFunction = (s: string) => void
export interface PerformanceRunner {
  runPerformance(): void
  getRecordedData(): any
  describeRunner(logger: LoggingFunction): void
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

export class SingleUserEventEmitter implements PerformanceRunner {
  public frequencyInMs: number
  public eventName: string
  public data: any

  constructor(o: any) {
    this.frequencyInMs = convertFrequency(o.frequency)
    this.eventName = o.event
    this.data = o.data
  }

  public runPerformance() {
    console.log('single user emit')
  }

  public getRecordedData() {

  }

  public describeRunner(logger: LoggingFunction) {
    logger('Single User Event Emitter')
    logger('')
    logger('Creates a single client that emits event at a regular pace')
    if (debugMode) {
      const data = {
        frequencyInMs: this.frequencyInMs,
        eventName: this.eventName,
        data: this.data
      }
      logData(logger, data, 'data')
    }
  }
}

export class SingleUserSubscriber implements PerformanceRunner {
  public eventName: string
  public onEventName: string

  constructor(o: any) {
    this.eventName = o.event
    this.onEventName = o['on-event']
  }

  public runPerformance() {
    console.log('single user sub')
  }

  public getRecordedData() {

  }

  public describeRunner(logger: LoggingFunction) {
    logger('Single User Subscriber')
    logger('')
    logger('Creates a single client that subscribes to an event and does something with the')
    if (debugMode) {
      const data = {
        eventName: this.eventName,
        onEventName: this.onEventName
      }
      logData(logger, data, 'data')
    }
  }
}

export class ParallelUsersEmit implements PerformanceRunner {
  public numberOfUsers: number
  public eventName: string
  public frequencyInMs: number
  public data: any

  constructor(o: any) {
    this.numberOfUsers = o.users
    this.eventName = o.event
    this.frequencyInMs = convertFrequency(o.frequency)
    this.data = o.data
  }

  public runPerformance() {
    console.log('parallel user emit')
  }

  public getRecordedData() {

  }

  public describeRunner(logger: LoggingFunction) {
    logger('Parallel Users Emit')
    logger('')
    logger('Creates several clients that emit to a single event at a given frequency')
    if (debugMode) {
      const data = {
        eventName: this.eventName,
        numberOfUsers: this.numberOfUsers,
        frequencyInMs: this.frequencyInMs,
        data: this.data
      }
      logData(logger, data, 'data')
    }
  }
}

export class OnAndOffSubscriber implements PerformanceRunner {
  public eventName: string
  public onEventName: string
  public frequencyInMs: number

  constructor(o: any) {
    this.eventName = o.event
    this.onEventName = o['on-event']
    this.frequencyInMs = convertFrequency(o.frequency)
  }

  public runPerformance() {
    console.log('on off sub')
  }

  public getRecordedData() {

  }

  public describeRunner(logger: LoggingFunction) {
    logger('On And Off Subscriber')
    logger('')
    logger('Creates a subscriber that repeatedly subscribes and unsubscribes')
    if (debugMode) {
      const data = {
        eventName: this.eventName,
        onEventName: this.onEventName,
        frequencyInMs: this.frequencyInMs
      }
      logData(logger, data, 'data')
    }
  }
}

export class EmptyRunner implements PerformanceRunner {
  // TODO: Throw anywhere here?
  constructor(o: any) {}
  public runPerformance() { console.log('empty') }
  public getRecordedData() {}
  public describeRunner(logger: LoggingFunction) { logger('Empty') }
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

