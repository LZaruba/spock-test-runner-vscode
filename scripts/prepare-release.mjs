#!/usr/bin/env node
// Prepares a release for the Release workflow (.github/workflows/release.yml):
// computes the next version, updates the README "Version" line and adds a
// CHANGELOG.md section built from the pull requests merged since the last release.
//
// Usage: node scripts/prepare-release.mjs <patch|minor|major|X.Y.Z> <prs.json> [notes-out.md]
//   prs.json   - output of `gh pr list --json number,title,url,author,labels`
//   notes-out  - where to write the new CHANGELOG section (the GitHub Release notes)
// Prints the new version on stdout. Does not touch package.json (use `npm version`).

import { readFileSync, writeFileSync } from 'fs'

const REPO_OWNER = 'LZaruba'
const SECTIONS = ['Added', 'Changed', 'Fixed']

const [bump, prsFile, notesFile = 'release-notes.md'] = process.argv.slice(2)
if (!bump || !prsFile) {
  console.error('Usage: prepare-release.mjs <patch|minor|major|X.Y.Z> <prs.json> [notes-out.md]')
  process.exit(1)
}

const current = JSON.parse(readFileSync('package.json', 'utf8')).version
const version = nextVersion(current, bump)
const date = new Date().toISOString().slice(0, 10)

const prs = JSON.parse(readFileSync(prsFile, 'utf8'))
  .filter(pr => !/^(release\b|bump to v?\d)/i.test(pr.title))
  .sort((a, b) => a.number - b.number)

const notes = buildNotes(prs)
writeFileSync(notesFile, notes)

const changelog = readFileSync('CHANGELOG.md', 'utf8')
if (new RegExp(`^## \\[${escape(version)}\\]`, 'm').test(changelog)) {
  fail(`CHANGELOG.md already has a section for ${version}`)
}
const firstSection = changelog.search(/^## \[/m)
const insertAt = firstSection === -1 ? changelog.length : firstSection
writeFileSync('CHANGELOG.md',
  changelog.slice(0, insertAt) + `## [${version}] - ${date}\n\n${notes}\n` + changelog.slice(insertAt))

const readme = readFileSync('README.md', 'utf8')
const versionLine = /^\*\*Version\*\*: .*$/m
if (!versionLine.test(readme)) {
  fail('README.md has no "**Version**: x.y.z" line')
}
writeFileSync('README.md', readme.replace(versionLine, `**Version**: ${version}`))

console.log(version)

function nextVersion(from, how) {
  if (/^\d+\.\d+\.\d+$/.test(how)) {
    return how
  }
  const [major, minor, patch] = from.split('.').map(Number)
  switch (how) {
    case 'major': return `${major + 1}.0.0`
    case 'minor': return `${major}.${minor + 1}.0`
    case 'patch': return `${major}.${minor}.${patch + 1}`
    default: return fail(`Unknown bump "${how}", use patch, minor, major or X.Y.Z`)
  }
}

function buildNotes(pullRequests) {
  if (pullRequests.length === 0) {
    return 'No user-facing changes in this release.\n'
  }

  const grouped = Object.fromEntries(SECTIONS.map(section => [section, []]))
  for (const pr of pullRequests) {
    grouped[sectionOf(pr)].push(`- ${cleanTitle(pr.title)} ([#${pr.number}](${pr.url}))`)
  }

  let notes = SECTIONS
    .filter(section => grouped[section].length > 0)
    .map(section => `### ${section}\n${grouped[section].join('\n')}\n`)
    .join('\n')

  const contributors = new Map()
  for (const pr of pullRequests) {
    const author = pr.author || {}
    if (author.login && !author.is_bot && !/\[bot\]$/.test(author.login) && author.login !== REPO_OWNER) {
      contributors.set(author.login, author.name || author.login)
    }
  }
  if (contributors.size > 0) {
    const names = [...contributors].map(([login, name]) => `**${name}** ([@${login}](https://github.com/${login}))`)
    notes += `\nThanks to ${joinNames(names)} for their contributions.\n`
  }
  return notes
}

function sectionOf(pr) {
  const title = pr.title.toLowerCase()
  const labels = (pr.labels || []).map(label => label.name.toLowerCase())
  if (labels.includes('bug') || /^fix\b|^fix[(:!]|^bug/.test(title)) {
    return 'Fixed'
  }
  if (labels.includes('enhancement') || labels.includes('feature') || /^feat\b|^feat[(:!]|^add\b/.test(title)) {
    return 'Added'
  }
  return 'Changed'
}

// "feat(discovery): support base classes" -> "Support base classes"
function cleanTitle(title) {
  const stripped = title.replace(/^\w+(\([^)]*\))?!?:\s*/, '').trim()
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

function joinNames(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
