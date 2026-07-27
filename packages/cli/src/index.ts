#!/usr/bin/env node
import { Command } from 'commander'
import { registry, type AdapterConstructor } from '@timer-bridge/core'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'

import { CsTimerAdapter } from '@timer-bridge/adapter-cstimer'
import { DCTimerAdapter } from '@timer-bridge/adapter-dctimer'
import { TwistyTimerAdapter } from '@timer-bridge/adapter-twistytimer'

registry.register('cstimer', CsTimerAdapter as unknown as AdapterConstructor)
registry.register('dctimer', DCTimerAdapter as unknown as AdapterConstructor)
registry.register('twistytimer', TwistyTimerAdapter as unknown as AdapterConstructor)

const program = new Command()

program
  .name('timer-bridge')
  .description('Convert Rubik\'s cube timer data between different formats')
  .version('0.1.0')

program
  .command('convert')
  .description('Convert a timer data file')
  .argument('<input>', 'Input file path')
  .argument('<target>', 'Target adapter id (cstimer, dctimer, twistytimer)')
  .option('-o, --output <path>', 'Output file path')
  .option('-f, --from <adapter>', 'Source adapter id (auto-detect if omitted)')
  .action(async (input: string, target: string, options: { output?: string; from?: string }) => {
    const inputPath = resolve(input)
    if (!existsSync(inputPath)) {
      console.error(`Error: File not found: ${inputPath}`)
      process.exit(1)
    }

    const ext = extname(inputPath).toLowerCase()
    const isBinary = ext === '.db' || ext === '.sqlite'
    const content: string | Uint8Array = isBinary
      ? new Uint8Array(readFileSync(inputPath))
      : readFileSync(inputPath, 'utf-8')

    const filename = inputPath.split(/[/\\]/).pop()

    try {
      let output: string | Uint8Array

      if (options.from) {
        output = await registry.convert(content, options.from, target, filename)
      } else {
        output = await registry.convertAuto(content, target, filename)
      }

      if (options.output) {
        const outPath = resolve(options.output)
        if (output instanceof Uint8Array) {
          writeFileSync(outPath, Buffer.from(output))
        } else {
          writeFileSync(outPath, output, 'utf-8')
        }
        console.log(`Written to ${outPath}`)
      } else {
        if (output instanceof Uint8Array) {
          console.log('[Binary output - use -o to write to file]')
        } else {
          console.log(output)
        }
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List available adapters')
  .action(() => {
    console.log('Available adapters:')
    for (const [id] of registry.getAllConstructors()) {
      console.log(`  - ${id}`)
    }
  })

program.parse(process.argv)
