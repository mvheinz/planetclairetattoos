import React from 'react'

import { Icon, type IconName } from '@/components/icons/Icon'

import styles from './Button.module.css'
import { LinkUnderline } from './LinkUnderline'

// Knöpfe und Links (DESIGN KO-11): Primär, Sekundär (gezeichnete Unterstreichung des Texts, MI-06) und Text-Link.
// Mit `href` entsteht ein echter Link (`<a>`), sonst ein `<button>` (Standard `type="button"`). Höhe ≥ 48 px, jede
// Zielfläche ≥ 44 × 44 px. Deaktiviert = `aria-disabled="true"` (Knöpfe zusätzlich `disabled`). Kein Knopf nutzt
// `--fox`/`--pink`. Der Bestell-Knopf („Zahlungspflichtig bestellen“) und der Widerruf-Knopf haben eigene Komponenten
// (Kasse P4, Fußbereich KO-04).
export type ButtonVariant = 'primary' | 'secondary' | 'link'

interface CommonProps {
  variant?: ButtonVariant
  children: React.ReactNode
  /** Optionales Icon vor dem Text (dekorativ). */
  icon?: IconName
  disabled?: boolean
  className?: string
  id?: string
  /** Seed der Unterstreichung (Sekundär); Standard: `href` bzw. Text. */
  underlineSeed?: string
  /**
   * Nur `aria-disabled="true"` (bleibt fokussierbar und liest den Grund aus `describedBy` vor, z. B. „Zur Kasse“ im Korb,
   * KO-13); der Server lehnt die Aktion ohnehin ab.
   */
  ariaDisabled?: boolean
  describedBy?: string
}

export type ButtonProps = CommonProps &
  (
    | {
        href: string
        /** Externe Links (Instagram): `noopener noreferrer` (R-139). */
        rel?: string
        type?: never
        name?: never
        value?: never
        form?: never
        onClick?: never
      }
    | {
        href?: undefined
        rel?: never
        type?: 'button' | 'submit' | 'reset'
        name?: string
        value?: string
        form?: string
        /** Nur in Client-Komponenten (z. B. „Nochmal versuchen“ auf R29). */
        onClick?: React.MouseEventHandler<HTMLButtonElement>
      }
  ) & { 'data-behavior'?: string; data?: Readonly<Record<`data-${string}`, string>> }

const VARIANT_CLASS: Record<ButtonVariant, string | undefined> = {
  primary: styles.primary,
  secondary: styles.secondary,
  link: styles.link,
}

const textOf = (node: React.ReactNode): string =>
  typeof node === 'string' || typeof node === 'number'
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join('')
      : ''

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    children,
    icon,
    disabled,
    className,
    id,
    underlineSeed,
    ariaDisabled,
    describedBy,
  } = props
  const classes = [styles.button, VARIANT_CLASS[variant], className].filter(Boolean).join(' ')
  const content = (
    <>
      {icon ? <Icon name={icon} size={20} className={styles.icon} /> : null}
      <span className={styles.label}>
        {children}
        {variant === 'secondary' ? (
          <LinkUnderline seed={underlineSeed ?? props.href ?? textOf(children)} />
        ) : null}
      </span>
    </>
  )
  const shared = {
    id,
    className: classes,
    'data-variant': variant,
    'data-underline-host': variant === 'secondary' ? '' : undefined,
    'data-behavior': props['data-behavior'],
    'aria-disabled': disabled || ariaDisabled ? ('true' as const) : undefined,
    'aria-describedby': describedBy,
    ...props.data,
  }

  if (props.href !== undefined) {
    return (
      <a
        {...shared}
        href={disabled ? undefined : props.href}
        rel={props.rel}
        role={disabled ? 'link' : undefined}
      >
        {content}
      </a>
    )
  }
  return (
    <button
      {...shared}
      type={props.type ?? 'button'}
      name={props.name}
      value={props.value}
      form={props.form}
      onClick={props.onClick}
      disabled={disabled}
    >
      {content}
    </button>
  )
}
