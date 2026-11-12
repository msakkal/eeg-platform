import fs from 'node:fs'
import path from 'node:path'
import { Parser } from 'acorn'
import jsx from 'acorn-jsx'

const parser = Parser.extend(jsx())
export const DISPLAY_ATTRIBUTES = [
  'title',
  'placeholder',
  'aria-label',
  'alt',
  'label',
  'caption',
  'context',
  'description',
  'criteria',
  'name',
  'activeText',
  'idleText',
  'onLabel',
  'offLabel',
]
export const normalize = (text) => text.replace(/\s+/g, ' ').trim()
export function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return
  if (node.type) visit(node, parent)
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node))
    else if (value && typeof value === 'object') walk(value, visit, node)
  }
}
export function sourceFiles(directory = 'src') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'i18n' ? [] : sourceFiles(file)
    return /\.(js|jsx)$/.test(file) ? [file] : []
  })
}
export function parse(code) {
  return parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' })
}
export function isProse(value) {
  const text = normalize(value)
  return (
    /[a-zA-Z]{2}/.test(text) &&
    !['ar', 'de', 'en', 'fr', 'es', 'ltr', 'rtl'].includes(text) &&
    !/^[a-z][\w]*(?:\.[\w]+)+$/.test(text) &&
    !/^(?:annotations\.|nav\.|calc\(|translate\(|\d+ \d+ \d+px)|^\S*-(?:axis|tick|chain|node|row|fade|hidden)[\w{}.-]*|^[\w-]+-\{\d+\}$|^\{\d+\}(?:AA|CC|px|10px)/.test(
      text,
    ) &&
    !/[_#]|https?:|^\/?[\w./-]+\.(?:js|json|txt|png|svg)|^[@./]|\b(?:px-|py-|flex-|text-|bg-|border-|font-|rounded-|items-|justify-|w-|h-|mt-|mb-|gap-|hover:|var\(|rgba?\()/.test(
      text,
    ) &&
    !/^[a-z]+[A-Z][a-zA-Z]*$/.test(text) &&
    !/^[A-Z\d-]{2,}$/.test(text) &&
    !/^[\d\s.μµ–—\-+%/()*×<>≤≥±:]+[a-zA-Z]{1,3}$/.test(text)
  )
}
export function collectSources() {
  const sources = new Set()
  const add = (value) => {
    if (isProse(value)) sources.add(normalize(value))
    if (/\n\s*\n/.test(value))
      value.split(/\n\s*\n/).forEach((part) => {
        if (isProse(part)) sources.add(normalize(part))
      })
  }
  for (const file of sourceFiles()) {
    walk(parse(fs.readFileSync(file, 'utf8')), (node, parent) => {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        // DOM selectors describe structure, not displayed language.
        if (
          parent?.type === 'CallExpression' &&
          parent.callee.type === 'MemberExpression' &&
          ['closest', 'querySelector', 'querySelectorAll', 'matches'].includes(
            parent.callee.property.name,
          )
        )
          return
        if (
          parent?.type === 'ImportDeclaration' ||
          (parent?.type === 'Property' && parent.key === node && !parent.computed)
        )
          return
        if (parent?.type === 'JSXAttribute' && !DISPLAY_ATTRIBUTES.includes(parent.name.name))
          return
        add(node.value)
      }
      if (node.type === 'JSXText') add(node.value)
      if (node.type === 'TemplateLiteral') {
        add(
          node.quasis
            .map(
              (part, index) =>
                part.value.cooked + (index < node.expressions.length ? `{${index}}` : ''),
            )
            .join(''),
        )
      }
    })
  }
  return [...sources].sort()
}
