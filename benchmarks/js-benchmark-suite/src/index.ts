import { createRunner, PerformanceRunner } from './runners'
import { parse } from './parser'
import { fork } from 'child_process'
import { sleep } from './util'
import * as fs from 'fs'
import * as dsUtils from 'deepstream-utils'

const quietDots = parseInt(process.env.NON_VERBOSE_DOTS) || false

function printUsage() {
  console.error('Usage: node index.js filepath [runner]')
}


function badJsonFile(fpath: string) {
  try {
    JSON.parse(fs.readFileSync(fpath, { encoding: 'utf-8' }))
    return false // this is not a bad file
  } catch (err) {
    return true // this is a bad file
  }
}


/**
 * The message sent from the client processes to the master process with what
 * the output was.
 */
interface ClientMessage {
  success: boolean
  output: Array<string>
}


/**
 * Runs the specified client until completion. Sends a ClientMessage to the
 * parent process.
 *
 * @param args
 */
async function runAsClient(fpath: string, clientName: string) {
  if (!process.send) {
    // If we want to debug and only run a single client we will print whatever
    // is sent to the master process instead of crashing
    process.send = console.log
  }
  const data = parse(fpath)
  const runners = data.runners.map(createRunner)
  const runnerArray = runners.filter(runner => runner.name === clientName)
  if (!runnerArray.length) {
    const message: ClientMessage = {
      success: false,
      output: [`Runner ${clientName} does not exist in ${fpath}`]
    }
    process.send(message)
    process.exit(-1)
  }

  let output: Array<string> = []
  const me = runnerArray[0]
  const logger = (line: string) => output.push(line)

  try {
    const result = await me.runPerformance(dsUtils, data.options)
    result.describe(logger)

    const message: ClientMessage = {
      success: true, output
    }
    process.send(message)
  } catch (error) {
    const errorStr = `${error}`
    const message: ClientMessage = {
      success: false,
      output: ['Caught Error in runner', '', errorStr]
    }
    process.send(message)
  }
}


/**
 * Starts Node.js subprocesses for runners. Returns an array of the running
 * processes.
 *
 * @param data
 * @param runners
 */
function startRunnerProcesses(fpath: string, runners: Array<PerformanceRunner>) {

  const startSingleRunner = (runner: PerformanceRunner) => {
    const { name } = runner
    const moduleName = __filename
    const args = [fpath, name]
    return fork(moduleName, args)
  }

  return runners.map(startSingleRunner)
}


/**
 * Parses the file, presents the different runners that will be run and then
 * runs them in their own processes.
 *
 * @param args
 */
async function runAsMaster(fpath: string) {
  const data = parse(fpath)
  const runners = data.runners.map(createRunner)
  const printIndentedLine = (line: string) => console.log(`   ${line}`)
  if (data.description) {
    console.log('===', 'Description'.padEnd(50), '===')
    if (typeof data.description === 'string') {
      printIndentedLine(data.description)
    } else {
      data.description.map(printIndentedLine)
    }
    console.log()
  }

  const printRunner = (runner: PerformanceRunner) => {
    const name = runner.name.padEnd(20)
    console.log(`   --- ${name} ---`)
    runner.describeRunner((s) => console.log(`   ${s}`))
    console.log()
  }

  console.log('===', 'Runners'.padEnd(50), '===')
  runners.map(printRunner)

  console.log('===', 'Lets get this show on the road!'.padEnd(50), '===')
  const runnerProcesses = startRunnerProcesses(fpath, runners)
  const sentinelValue = 'unfinished runner'
  const runnerResults = Array(runnerProcesses.length).fill(sentinelValue)

  for (const index in runnerProcesses) {
    const process = runnerProcesses[index]
    process.on('message', m => {
      const message = m as ClientMessage
      runnerResults[index] = message
    })
  }

  const allRunnersCompleted = () => {
    return runnerResults.every(elem => elem !== sentinelValue)
  }

  // Just here to print that nothing has hanged up
  let loops = 0
  const checkInterval = 1000
  while (!allRunnersCompleted()) {
    loops++
    if (!quietDots) {
      if (loops % 5 === 0) {
        process.stdout.write(`${loops}`)
      } else {
        process.stdout.write('.')
      }
    }
    await sleep(checkInterval)
  }

  // Sleep for 2 seconds, just to make sure everything stops nicely
  await sleep(2000)
  console.log()

  console.log('===', 'Results'.padEnd(50), '===')
  runnerResults.map((result: ClientMessage, index: number) => {
    const suffix = result.success ? '' : 'Failed'
    const name = runners[index].name.padEnd(20)
    console.log(`   --- ${name} --- ${suffix}`)
    const { output } = result
    output.map(printIndentedLine)
    console.log()
  })
}


async function main() {
  const args: Array<string> = process.argv.slice(2)
  const availableLengths = [1, 2]
  if (!availableLengths.includes(args.length)) {
    printUsage()
    process.exit(-1)
  }

  const fpath = args[0]

  if (!fs.existsSync(fpath)) {
    console.error(fpath, 'is not a valid file path...')
    process.exit(-1)
  }

  if (badJsonFile(fpath)) {
    console.error(fpath, 'does not seem to be a valid JSON file')
    process.exit(-1)
  }

  if (args.length === 1) {
    await runAsMaster(fpath)
  } else if (args.length === 2) {
    await runAsClient(fpath, args[1])
  } else {
    throw Error(`Args is somehow wrong length? args.length=${args.length}`)
  }
}

main().then(() => process.exit(0)).catch(console.error)
