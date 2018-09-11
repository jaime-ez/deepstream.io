import { createRunner, PerformanceRunner } from './runners'
import { parse } from './parser'
import * as fs from 'fs'
import * as dsUtils from 'deepstream-utils'

function printUsage() {
  console.error('Usage: node index.js filepath')
}


function badJsonFile(fpath: string) {
  try {
    JSON.parse(fs.readFileSync(fpath, { encoding: 'utf-8' }))
    return false // this is not a bad file
  } catch (err) {
    return true // this is a bad file
  }
}


async function main() {
  const args: Array<string> = process.argv.slice(2)
  if (args.length !== 1) {
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
    console.log('   -----')
    runner.describeRunner((s) => console.log(`   ${s}`))
    console.log()
  }

  console.log('===', 'Runners'.padEnd(50), '===')
  runners.map(printRunner)

  console.log('===', 'Lets get this show on the road!'.padEnd(50), '===')
  const availableRunners = runners.map(
    runner => runner.runPerformance(dsUtils, data.options)
  )

  // Just here to print that nothing has hanged up
  let continueChecker = true
  let loops = 0
  const checkInterval = 1000
  const checkSingle = () => {
    loops++
    if (loops % 5 === 0) {
      process.stdout.write(`${loops}`)
    } else {
      process.stdout.write('.')
    }
    if (continueChecker) {
      setTimeout(checkSingle, checkInterval)
    }
  }
  setTimeout(checkSingle, checkInterval)

  const runnerResult = []
  for (const runner of availableRunners) {
    runnerResult.push(await runner)
  }

  continueChecker = false
  await new Promise((resolve, reject) => {
    setTimeout(() => resolve(), 2000)
  })
  console.log()

  console.log('===', 'Results'.padEnd(50), '===')
  runnerResult.map((result: any) => {
    console.log('   -----')
    result.describe(printIndentedLine)
    console.log()
  })
}

main().then(() => process.exit(0)).catch(console.error)
