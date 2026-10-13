/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AppBreadCrumbs } from '@/components/custom/breadcrumbs/AppBreadCrumbs'
import AppMultiSelect from '@/components/custom/select/AppMultiSelect'
import AppSelect from '@/components/custom/select/AppSelect'
import { Button } from '@/components/ui/button'
import { ProductMixApi } from '@/fineract-api'
import fineract from '@/lib/axios'
import { getConfiguration } from '@/lib/fineract-openapi'

import {
  apiError,
  restrictableProducts,
  type NamedProduct,
  type ProductMix,
  type ProductMixError,
} from './types'

const productMixApi = new ProductMixApi(getConfiguration())

/**
 * Creates a product mix (POST /loanproducts/{id}/productmix), as in the
 * Angular web app: pick a loan product that has no mix yet, then the loan
 * products a client may not hold at the same time as it.
 */
const CreateProductMix = () => {
  const { t } = useTranslation(['products', 'common'])
  const navigate = useNavigate()
  const [productOptions, setProductOptions] = useState<NamedProduct[]>([])
  const [productId, setProductId] = useState('')
  const [candidates, setCandidates] = useState<NamedProduct[]>([])
  const [restricted, setRestricted] = useState<string[]>([])
  const [error, setError] = useState<ProductMixError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        // Only the loan products that do not have a product mix yet
        const res = await fineract.get<{ productOptions?: NamedProduct[] }>(
          'v1/loanproducts/template',
          { params: { isProductMixTemplate: true } }
        )
        setProductOptions(res.data?.productOptions ?? [])
      } catch (err) {
        setError(apiError(err, 'loadProducts'))
      }
    })()
  }, [])

  useEffect(() => {
    setCandidates([])
    setRestricted([])
    if (!productId) return
    ;(async () => {
      try {
        const res = await productMixApi.retrieveTemplate12(Number(productId), {
          params: { template: true },
        })
        const mix = (res.data ?? {}) as ProductMix
        setCandidates(restrictableProducts(mix))
        setRestricted((mix.restrictedProducts ?? []).map(p => String(p.id)))
      } catch (err) {
        setError(apiError(err, 'loadMix'))
      }
    })()
  }, [productId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!productId) return setError({ key: 'selectProduct' })
    if (restricted.length === 0) return setError({ key: 'selectRestricted' })
    setSubmitting(true)
    setError(null)
    try {
      await productMixApi.createProductMix(Number(productId), {
        restrictedProducts: restricted.map(Number),
      })
      navigate(`/products/products-mix/${productId}`)
    } catch (err) {
      setError(apiError(err, 'create'))
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
          { label: t('common:actions.create'), current: true },
        ]}
      />

      <div className="bg-white dark:bg-zinc-900 rounded-md border p-8 shadow max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold mb-6">
          {t('productMix.create.title')}
        </h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <AppSelect
            selectLabel={t('productMix.create.productRequired')}
            selectPlaceholder={
              productOptions.length
                ? t('productMix.create.productPlaceholder')
                : t('productMix.create.noProducts')
            }
            selectValue={productId}
            selectOnChange={v => {
              setProductId(v)
              setError(null)
            }}
            selectOptions={productOptions.map(p => ({
              id: p.id ?? '',
              name: p.name ?? '',
            }))}
            selectClassname="w-full space-y-2"
          />
          <AppMultiSelect
            selectLabel={t('productMix.restrictedProductsRequired')}
            selectPlaceholder={
              productId
                ? t('productMix.selectProducts')
                : t('productMix.create.selectProductFirst')
            }
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
              onClick={() => navigate('/products/products-mix')}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="submit"
              className="bg-[#1074b9] hover:bg-[#1074c9] text-white"
              disabled={submitting}
            >
              {t('common:actions.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateProductMix
