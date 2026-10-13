/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'

import { AppBreadCrumbs } from '@/components/custom/breadcrumbs/AppBreadCrumbs'
import AppSelect from '@/components/custom/select/AppSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import fineract from '@/lib/axios'
import { dateArrayToInputValue, inputToFineractDate } from '@/lib/date-utils'

type Named = { id?: number; name?: string }
type Currency = { code?: string; displayLabel?: string; name?: string }

type AccountBalance = {
  glAccountId?: number
  glAccountName?: string
  glAccountCode?: string
  glAccountType?: { value?: string }
}

/** GET /journalentries/openingbalance (the API spells "liabity") */
type OpeningBalanceData = {
  officeName?: string
  transactionDate?: number[]
  contraAccount?: { name?: string; glCode?: string }
  assetAccountOpeningBalances?: AccountBalance[]
  liabityAccountOpeningBalances?: AccountBalance[]
  equityAccountOpeningBalances?: AccountBalance[]
  incomeAccountOpeningBalances?: AccountBalance[]
  expenseAccountOpeningBalances?: AccountBalance[]
}

type ApiErrorResponse = {
  defaultUserMessage?: string
  errors?: Array<{ defaultUserMessage?: string }>
}

/** The Fineract error message, if the response carries one */
const apiMessage = (err: unknown) => {
  const data = (err as AxiosError<ApiErrorResponse>).response?.data
  return (
    data?.errors?.[0]?.defaultUserMessage ||
    data?.defaultUserMessage ||
    undefined
  )
}

/** Which load failed (translated at render); message is Fineract's own */
type LoadError = { kind: 'loadLists' | 'loadOffice'; message?: string }

type GroupKey = 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses'

type Amounts = Record<number, { debit: string; credit: string }>

const sum = (amounts: Amounts, side: 'debit' | 'credit') =>
  Object.values(amounts).reduce((total, a) => total + (Number(a[side]) || 0), 0)

const money = (value: number) =>
  value.toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/**
 * Accounting > Migrate Opening Balances (Office-wise), as in the Angular web
 * app: pick an office, then enter each GL account's opening debit or credit.
 * Fineract posts them as one journal entry against the office's opening
 * balance contra account, so the debits must equal the credits.
 */
const OpeningBalances = () => {
  const { t } = useTranslation(['accounting', 'common'])
  const [offices, setOffices] = useState<Named[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [officeId, setOfficeId] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [data, setData] = useState<OpeningBalanceData | null>(null)
  const [amounts, setAmounts] = useState<Amounts>({})
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [postedId, setPostedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const [o, c] = await Promise.all([
          fineract.get<Named[]>('v1/offices'),
          fineract.get<{ selectedCurrencyOptions?: Currency[] }>(
            'v1/currencies'
          ),
        ])
        setOffices(o.data ?? [])
        const options = c.data?.selectedCurrencyOptions ?? []
        setCurrencies(options)
        if (options.length === 1) setCurrencyCode(options[0].code ?? '')
      } catch (err) {
        setLoadError({ kind: 'loadLists', message: apiMessage(err) })
      }
    })()
  }, [])

  useEffect(() => {
    setData(null)
    setAmounts({})
    setLoadError(null)
    setPostedId(null)
    if (!officeId) return
    ;(async () => {
      try {
        const res = await fineract.get<OpeningBalanceData>(
          'v1/journalentries/openingbalance',
          { params: { officeId } }
        )
        setData(res.data ?? {})
        setTransactionDate(dateArrayToInputValue(res.data?.transactionDate))
      } catch (err) {
        setLoadError({ kind: 'loadOffice', message: apiMessage(err) })
      }
    })()
  }, [officeId])

  const groups: [GroupKey, AccountBalance[]][] = data
    ? [
        ['assets', data.assetAccountOpeningBalances ?? []],
        ['liabilities', data.liabityAccountOpeningBalances ?? []],
        ['equity', data.equityAccountOpeningBalances ?? []],
        ['income', data.incomeAccountOpeningBalances ?? []],
        ['expenses', data.expenseAccountOpeningBalances ?? []],
      ]
    : []

  const debits = sum(amounts, 'debit')
  const credits = sum(amounts, 'credit')
  const bothSides = Object.values(amounts).some(
    a => Number(a.debit) > 0 && Number(a.credit) > 0
  )
  const balanced = debits > 0 && Math.abs(debits - credits) < 0.005

  const setAmount = (id: number, side: 'debit' | 'credit', value: string) => {
    setAmounts(prev => {
      const current = prev[id] ?? { debit: '', credit: '' }
      return { ...prev, [id]: { ...current, [side]: value } }
    })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!currencyCode)
      return setError(t('openingBalances.errors.selectCurrency'))
    if (!transactionDate) return setError(t('openingBalances.errors.enterDate'))
    if (bothSides) return setError(t('openingBalances.errors.bothSides'))
    if (!balanced) return setError(t('openingBalances.errors.unbalanced'))

    const entries = Object.entries(amounts)
    setSubmitting(true)
    setError(null)
    try {
      const res = await fineract.post<{ transactionId?: string }>(
        'v1/journalentries',
        {
          officeId: Number(officeId),
          currencyCode,
          transactionDate: inputToFineractDate(transactionDate),
          dateFormat: 'dd MMMM yyyy',
          locale: 'en',
          debits: entries
            .filter(([, a]) => Number(a.debit) > 0)
            .map(([id, a]) => ({
              glAccountId: Number(id),
              amount: Number(a.debit),
            })),
          credits: entries
            .filter(([, a]) => Number(a.credit) > 0)
            .map(([id, a]) => ({
              glAccountId: Number(id),
              amount: Number(a.credit),
            })),
        },
        { params: { command: 'defineOpeningBalance' } }
      )
      setPostedId(res.data?.transactionId ?? '')
      setAmounts({})
    } catch (err) {
      setError(apiMessage(err) ?? t('openingBalances.errors.save'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-7xl mx-auto text-[15px]">
      <AppBreadCrumbs
        items={[
          { label: t('common:nav.home'), href: '/home' },
          { label: t('title'), href: '/accounting' },
          { label: t('openingBalances.breadcrumb'), current: true },
        ]}
      />

      <form
        className="bg-white dark:bg-zinc-900 rounded-md border p-6 shadow space-y-6"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col md:flex-row md:flex-wrap gap-4">
          <AppSelect
            selectLabel={t('openingBalances.fields.office')}
            selectPlaceholder={t('openingBalances.fields.officePlaceholder')}
            selectValue={officeId}
            selectOnChange={setOfficeId}
            selectOptions={offices.map(o => ({
              id: o.id ?? '',
              name: o.name ?? '',
            }))}
            selectClassname="w-full md:w-[32%] space-y-2"
          />
          <AppSelect
            selectLabel={t('openingBalances.fields.currency')}
            selectPlaceholder={t('openingBalances.fields.currencyPlaceholder')}
            selectValue={currencyCode}
            selectOnChange={setCurrencyCode}
            selectOptions={currencies.map(c => ({
              id: c.code ?? '',
              name: c.displayLabel ?? c.name ?? c.code ?? '',
            }))}
            selectClassname="w-full md:w-[32%] space-y-2"
          />
          <div className="w-full md:w-[32%] space-y-2">
            <Label htmlFor="transactionDate">
              {t('openingBalances.fields.transactionDate')}
            </Label>
            <Input
              id="transactionDate"
              type="date"
              value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)}
            />
          </div>
        </div>

        {loadError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            {loadError.message ?? t(`openingBalances.errors.${loadError.kind}`)}{' '}
            {/* The usual cause: no account mapped to Opening Balances Contra */}
            <Link
              to="/accounting/financial-activity-mappings"
              className="font-medium underline"
            >
              {t('openingBalances.checkMappings')}
            </Link>
          </div>
        )}

        {data && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {t('openingBalances.contraAccount')}{' '}
              <span className="font-medium">
                {data.contraAccount?.name} ({data.contraAccount?.glCode})
              </span>
            </p>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3">
                      {t('openingBalances.table.account')}
                    </TableHead>
                    <TableHead className="px-4 py-3">
                      {t('openingBalances.table.glCode')}
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right">
                      {t('openingBalances.table.debit')}
                    </TableHead>
                    <TableHead className="px-4 py-3 text-right">
                      {t('openingBalances.table.credit')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(([group, accounts]) =>
                    accounts.length === 0
                      ? null
                      : [
                          <TableRow key={group} className="bg-muted/50">
                            <TableCell
                              colSpan={4}
                              className="px-4 py-2 font-semibold"
                            >
                              {t(`openingBalances.groups.${group}`)}
                            </TableCell>
                          </TableRow>,
                          ...accounts.map(a => {
                            const id = a.glAccountId ?? 0
                            return (
                              <TableRow key={id}>
                                <TableCell className="px-4 py-2">
                                  {a.glAccountName}
                                </TableCell>
                                <TableCell className="px-4 py-2">
                                  {a.glAccountCode}
                                </TableCell>
                                {(['debit', 'credit'] as const).map(side => (
                                  <TableCell
                                    key={side}
                                    className="px-4 py-2 text-right"
                                  >
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      className="w-36 ml-auto text-right"
                                      aria-label={t(
                                        `openingBalances.amountLabel.${side}`,
                                        {
                                          account: a.glAccountName ?? '',
                                        }
                                      )}
                                      value={amounts[id]?.[side] ?? ''}
                                      onChange={e =>
                                        setAmount(id, side, e.target.value)
                                      }
                                    />
                                  </TableCell>
                                ))}
                              </TableRow>
                            )
                          }),
                        ]
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="px-4 py-3 font-semibold">
                      {t('openingBalances.table.total')}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(debits)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(credits)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {!balanced && debits + credits > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('openingBalances.difference', {
                  amount: money(Math.abs(debits - credits)),
                })}
              </p>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {postedId !== null && (
          <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300">
            <Trans
              t={t}
              i18nKey="openingBalances.saved"
              values={{ id: postedId }}
              components={{ id: <span className="font-mono" /> }}
            />{' '}
            <Link
              to="/accounting/journal-entries"
              className="font-medium underline"
            >
              {t('openingBalances.openJournalEntries')}
            </Link>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-[#1074b9] hover:bg-[#1074c9] text-white"
            disabled={submitting || !data}
          >
            {submitting
              ? t('common:actions.saving')
              : t('common:actions.submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default OpeningBalances
