import { createRunner, PerformanceRunner } from './runners'
import { parse } from './parser'
import * as fs from 'fs'

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

function main() {
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
  if (data.description) {
    console.log('===', 'Description'.padEnd(50), '===')
    const printLine = (line: string) => console.log(`   ${line}`)
    if (typeof data.description === 'string') {
      printLine(data.description)
    } else {
      data.description.map(printLine)
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
}

main()
