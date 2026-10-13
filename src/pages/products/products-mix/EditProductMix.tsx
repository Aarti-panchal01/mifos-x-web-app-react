/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AppBreadCrumbs } from '@/components/custom/breadcrumbs/AppBreadCrumbs'
import AppMultiSelect from '@/components/custom/select/AppMultiSelect'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ProductMixApi } from '@/fineract-api'
import { getConfiguration } from '@/lib/fineract-openapi'

import {
  apiError,
  restrictableProducts,
  type NamedProduct,
  type ProductMix,
  type ProductMixError,
} from './types'

const productMixApi = new ProductMixApi(getConfiguration())

/** Edits the restricted products of a product mix (PUT /loanproducts/{id}/productmix) */
const EditProductMix = () => {
  const { t } = useTranslation(['products', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [mix, setMix] = useState<ProductMix | null>(null)
  const [candidates, setCandidates] = useState<NamedProduct[]>([])
  const [restricted, setRestricted] = useState<string[]>([])
  const [error, setError] = useState<ProductMixError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await productMixApi.retrieveTemplate12(Number(id), {
          params: { template: true },
        })
        const data = (res.data ?? {}) as ProductMix
        setMix(data)
        setCandidates(restrictableProducts(data))
        setRestricted((data.restrictedProducts ?? []).map(p => String(p.id)))
      } catch (err) {
        setError(apiError(err, 'loadMix'))
      }
    })()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (restricted.length === 0)
      return setError({ key: 'selectRestrictedOrDelete' })
    setSubmitting(true)
    setError(null)
    try {
      await productMixApi.updateProductMix(Number(id), {
        restrictedProducts: restricted.map(Number),
      })
      navigate(`/products/products-mix/${id}`)
    } catch (err) {
      setError(apiError(err, 'update'))
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-7xl mx-auto text-[15px]">
      <AppBreadCrumbs
        items={[
          { label: t('common:nav.home'), href: '/home' },
          { label: t('title'), href: '/products' },
          { label: t('productsMix'), href: '/products/products-mix' },
          {
            label: mix?.productName ?? id ?? '',
            href: `/products/products-mix/${id}`,
          },
          { label: t('common:actions.edit'), current: true },
        ]}
      />

      <div className="bg-white dark:bg-zinc-900 rounded-md border p-8 shadow max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6">
          {t('productMix.edit.title')}
        </h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{t('product')}</Label>
            <p>{mix?.productName ?? '—'}</p>
          </div>
          <AppMultiSelect
            selectLabel={t('productMix.restrictedProductsRequired')}
            selectPlaceholder={t('productMix.selectProducts')}
            selectValues={restricted}
            selectOnChange={v => {
              setRestricted(v)
              setError(null)
            }}
            selectOptions={candidates.map(p => ({
              id: p.id ?? '',
              name: p.name ?? '',
            }))}
            selectClassname="w-full space-y-2"
          />

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
              {error.message ?? t(`productMix.errors.${error.key}`)}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/products/products-mix/${id}`)}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-[#1074b9] hover:bg-[#1074c9] text-white"
              disabled={submitting || !mix}
            >
              {t('common:actions.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditProductMix
