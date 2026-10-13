/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'

import { AppBreadCrumbs } from '@/components/custom/breadcrumbs/AppBreadCrumbs'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ProductMixApi } from '@/fineract-api'
import { getConfiguration } from '@/lib/fineract-openapi'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons'

import {
  apiError,
  type NamedProduct,
  type ProductMix,
  type ProductMixError,
} from './types'

const productMixApi = new ProductMixApi(getConfiguration())

const ProductList = ({
  title,
  products,
}: {
  title: string
  products: NamedProduct[]
}) => {
  const { t } = useTranslation('products')
  return (
    <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {products.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {t('productMix.none')}
        </p>
      ) : (
        <ul className="list-disc pl-5 space-y-1">
          {products.map(p => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** View Product Mix, with Edit and Delete, as in the Angular web app */
const ViewProductMix = () => {
  const { t } = useTranslation(['products', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [mix, setMix] = useState<ProductMix | null>(null)
  const [error, setError] = useState<ProductMixError | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const res = await productMixApi.retrieveTemplate12(Number(id))
        setMix((res.data ?? {}) as ProductMix)
      } catch (err) {
        setError(apiError(err, 'loadMix'))
      }
    })()
  }, [id])

  const handleDelete = async () => {
    if (!id || deleting) return
    setDeleting(true)
    setError(null)
    try {
      await productMixApi.deleteProductMix(Number(id))
      setConfirmOpen(false)
      navigate('/products/products-mix')
    } catch (err) {
      setError(apiError(err, 'delete'))
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-7xl mx-auto text-[15px]">
      <AppBreadCrumbs
        items={[
          { label: t('common:nav.home'), href: '/home' },
          { label: t('title'), href: '/products' },
          { label: t('productsMix'), href: '/products/products-mix' },
          { label: mix?.productName ?? id ?? '', current: true },
        ]}
      />

      {/* Edit and Delete only once the product mix has loaded */}
      {mix && (
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            className="bg-[#1074b9] hover:bg-[#1074c9] cursor-pointer text-white"
            onClick={() => navigate(`/products/products-mix/${id}/edit`)}
          >
            <FontAwesomeIcon icon={faPen} className="mr-2" />
            {t('common:actions.edit')}
          </Button>
          <AlertDialog
            open={confirmOpen}
            onOpenChange={open => {
              if (!deleting) {
                setConfirmOpen(open)
                setError(null)
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                disabled={deleting}
              >
                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                {deleting
                  ? t('productMix.deleting')
                  : t('common:actions.delete')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t('common:actions.delete')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('productMix.deleteConfirm', {
                    name: mix?.productName ?? '',
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error.message ?? t(`productMix.errors.${error.key}`)}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  {t('common:actions.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleting}
                  onClick={e => {
                    // Keep the dialog open until the request finishes
                    e.preventDefault()
                    handleDelete()
                  }}
                >
                  {deleting
                    ? t('productMix.deleting')
                    : t('productMix.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {error && !confirmOpen && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {error.message ?? t(`productMix.errors.${error.key}`)}
        </div>
      )}

      {mix && (
        <div className="space-y-6">
          <p>
            <Trans
              t={t}
              i18nKey="productMix.summary"
              values={{ name: mix.productName ?? '' }}
              components={{ strong: <strong /> }}
            />
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProductList
              title={t('productMix.restrictedProducts')}
              products={mix.restrictedProducts ?? []}
            />
            <ProductList
              title={t('productMix.allowedProducts')}
              products={mix.allowedProducts ?? []}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewProductMix
