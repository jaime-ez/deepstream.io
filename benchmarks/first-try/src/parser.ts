import * as fs from 'fs'

function getDescription(data: any) {
  return data.description || ''
}

function getPerformanceObjects(data: any): Array<any> {
  const filterF = (s: string) => s.startsWith('perf-')
  const perfKeys = Object.keys(data).filter(filterF)

  const convertObject = (key: string) => {
    const name: string = key.substr('perf-'.length)
    const perfData: any = data[key]
    return {name, ...perfData}
  }

  return perfKeys.map(convertObject)
}

function getOptions(data: any): object {
  return data.options || {}
}

export function parse(fpath: string) {
  const data = JSON.parse(fs.readFileSync(fpath, { encoding: 'utf-8'} ))

  return {
    runners: getPerformanceObjects(data),
    description: getDescription(data),
    options: getOptions(data)
  }
}
