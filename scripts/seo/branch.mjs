#!/usr/bin/env node
// The SEO routine's page-edit branch workflow as one committed script, so the
// whole flow runs under `Bash(node scripts/seo/:*)` with no permission prompts.
// It never touches the shared working tree (another session may hold
// uncommitted edits there) and never merges.
//
//   node scripts/seo/branch.mjs start <branch>     worktree at .claude/worktrees/<name> from origin/main
//   node scripts/seo/branch.mjs check <branch>     npx tsc --noEmit inside it
//   node scripts/seo/branch.mjs finish <branch> --message-file <f> <path> [...]
//        commit those paths, push -u, print the merge preview vs main, remove the worktree
//   node scripts/seo/branch.mjs ship <branch>      ONLY after Keith says "ship SEO item N": merge into
//                                                  origin/main in a worktree, push, delete the branch
//   node scripts/seo/branch.mjs rebase <branch>    rebase a pending branch onto origin/main in a worktree,
//                                                  push --force-with-lease, remove the worktree
//
// Edit files with the Edit tool at the path `start` prints.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const [cmd, branch, ...rest] = process.argv.slice(2)

if (!cmd || !branch || !branch.startsWith('seo/')) {
  console.error('usage: branch.mjs start|check|finish|rebase seo/<name> ...')
  process.exit(2)
}

const wt = path.join(ROOT, '.claude/worktrees', branch.replace(/\//g, '-'))
const run = (bin, args, cwd = ROOT) =>
  execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const git = (args, cwd) => run('git', args, cwd)

function linkModules() {
  const link = path.join(wt, 'node_modules')
  if (!fs.existsSync(link)) fs.symlinkSync(path.join(ROOT, 'node_modules'), link)
}

function remove() {
  const link = path.join(wt, 'node_modules')
  if (fs.existsSync(link)) fs.unlinkSync(link)
  git(['worktree', 'remove', wt])
  console.log(`removed worktree ${wt}`)
}

function preview() {
  try {
    const tree = git(['merge-tree', '--write-tree', '--name-only', 'origin/main', branch]).split('\n')[0]
    console.log('merge preview vs origin/main (clean):')
    console.log(git(['diff', '--stat', 'origin/main', tree]))
  } catch (e) {
    console.log('MERGE WOULD CONFLICT:')
    console.log(String(e.stdout ?? e.message))
  }
}

try {
  git(['fetch', '-q', 'origin'])
  if (cmd === 'start') {
    git(['worktree', 'add', '-b', branch, wt, 'origin/main'])
    linkModules()
    console.log(`worktree ready: ${wt}`)
  } else if (cmd === 'check') {
    linkModules()
    try {
      run('npx', ['tsc', '--noEmit'], wt)
      console.log('typecheck clean')
    } catch (e) {
      console.log(String(e.stdout ?? '') + String(e.stderr ?? ''))
      process.exit(1)
    }
  } else if (cmd === 'finish') {
    const mf = rest.indexOf('--message-file')
    if (mf < 0) throw new Error('--message-file required')
    const msgFile = path.resolve(ROOT, rest[mf + 1])
    const paths = rest.filter((_, i) => i !== mf && i !== mf + 1)
    if (!paths.length) throw new Error('name the paths to commit')
    git(['add', '--', ...paths], wt)
    git(['commit', '-q', '-F', msgFile, '--', ...paths], wt)
    console.log(git(['log', '--oneline', '-1'], wt))
    git(['push', '-q', '-u', 'origin', branch], wt)
    console.log(`pushed ${branch}`)
    preview()
    remove()
  } else if (cmd === 'ship') {
    // Only when Keith has said "ship SEO item N". Merges on a detached
    // worktree at origin/main, pushes main, deletes the branch everywhere.
    git(['worktree', 'add', '--detach', wt, 'origin/main'])
    try {
      git(['merge', '--no-ff', '-m', `Merge ${branch} (approved by Keith)`, branch], wt)
    } catch (e) {
      git(['merge', '--abort'], wt)
      remove()
      console.log(`MERGE CONFLICT on ${branch}: nothing pushed.`)
      process.exit(1)
    }
    git(['push', '-q', 'origin', 'HEAD:main'], wt)
    console.log(`merged and pushed: ${git(['log', '--oneline', '-1'], wt)}`)
    remove()
    git(['push', '-q', 'origin', '--delete', branch])
    git(['branch', '-D', branch])
    console.log(`deleted ${branch} (local + remote)`)
  } else if (cmd === 'rebase') {
    git(['worktree', 'add', wt, branch])
    try {
      git(['rebase', 'origin/main'], wt)
    } catch (e) {
      git(['rebase', '--abort'], wt)
      remove()
      console.log(`REBASE CONFLICT on ${branch} — left unchanged. Report it as a blocker.`)
      process.exit(1)
    }
    git(['push', '-q', '--force-with-lease', 'origin', branch], wt)
    console.log(`rebased and pushed ${branch}`)
    preview()
    remove()
  } else {
    throw new Error(`unknown command ${cmd}`)
  }
} catch (e) {
  console.error(`branch.mjs failed: ${String(e.stderr ?? '') || e.message}`)
  process.exit(1)
}
