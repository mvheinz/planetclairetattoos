import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Zeit nur über die übergebene Uhr (ARCHITEKTUR §15.4, A-08).
const noAmbientTime = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      'new Date() ohne Argument ist hier verboten – clock.now() bzw. übergebenes now nutzen (ARCHITEKTUR §15.4).',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Date.now() ist hier verboten – clock.now() bzw. übergebenes now nutzen (ARCHITEKTUR §15.4).',
  },
]

// Geld nur als Integer-Cent, Formatierung nur mit formatMoney (ARCHITEKTUR §15.4).
const noFloatMoney = [
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message:
      'toFixed ist bei Beträgen verboten – formatMoney(cents, locale) nutzen (ARCHITEKTUR §15.4).',
  },
]

// Laufzeit ohne Framework (A-11): Verhaltensmodule, Leine und Vorschau-Laufzeit.
const frameworkFree = {
  paths: [
    { name: 'react', message: 'Verhaltensmodule sind framework-frei (ARCHITEKTUR A-11).' },
    { name: 'react-dom', message: 'Verhaltensmodule sind framework-frei (ARCHITEKTUR A-11).' },
    { name: 'next', message: 'Verhaltensmodule sind framework-frei (ARCHITEKTUR A-11).' },
    { name: 'payload', message: 'Verhaltensmodule sind framework-frei (ARCHITEKTUR A-11).' },
  ],
  patterns: [
    {
      group: ['next/*', '@payloadcms/*', 'react/*', 'react-dom/*'],
      message: 'Verhaltensmodule sind framework-frei (ARCHITEKTUR A-11).',
    },
  ],
}

// eslint-config-next 16 liefert native Flat-Configs (kein FlatCompat mehr nötig).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['src/app/(payload)/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx,js,mjs}'],
    ignores: ['src/lib/monitoring/logger.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: ['src/lib/jobs/**', 'src/jobs/**', 'src/lib/legal/**'],
    rules: { 'no-restricted-syntax': ['error', ...noAmbientTime] },
  },
  {
    files: ['src/lib/commerce/**'],
    rules: { 'no-restricted-syntax': ['error', ...noAmbientTime, ...noFloatMoney] },
  },
  {
    files: ['src/behaviors/**', 'src/leash/**', 'src/preview-runtime/**'],
    rules: { 'no-restricted-imports': ['error', frameworkFree] },
  },
  globalIgnores([
    '.next/**',
    '.next-preview/**',
    'node_modules/**',
    'dist/**',
    'src/payload-types.ts',
    'src/payload-generated-schema.ts',
    'src/app/(payload)/admin/importMap.js',
    'docs/**',
  ]),
])
