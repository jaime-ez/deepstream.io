const { exec } = require('pkg')

const LTS = process.env.LTS
let OS = process.env.OS

if (OS === 'win32') {
  OS = 'win'
}
if (OS === 'darwin') {
  OS = 'macos'
}

const target = 'node'+ LTS + '-' + OS

console.log('TARGET', target);

exec(
  [
    'package.json',
    '--targets',
    target,
    '--output',
    process.env.EXECUTABLE_NAME,
    '--options',
    '--max-old-space-size=8192',
    '--compress',
    'GZip'
  ]).then(() => {
  console.log('success')
})
