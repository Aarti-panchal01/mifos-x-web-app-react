/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import type { AxiosError } from 'axios'

export type NamedProduct = { id?: number; name?: string }

/**
 * One product mix, from GET /loanproducts?associations=productMixes or
 * GET /loanproducts/{id}/productmix: a loan product and the loan products a
 * client cannot hold at the same time as it (restricted).
 */
export type ProductMix = {
  productId?: number
  productName?: string
  restrictedProducts?: NamedProduct[]
  allowedProducts?: NamedProduct[]
}

type ApiErrorResponse = {
  defaultUserMessage?: string
  errors?: Array<{ defaultUserMessage?: string }>
}

/** The keys of productMix.errors in the products namespace */
export type ProductMixErrorKey =
  | 'create'
  | 'delete'
  | 'loadMix'
  | 'loadProducts'
  | 'selectProduct'
  | 'selectRestricted'
  | 'selectRestrictedOrDelete'
  | 'update'

/**
 * An error to show: Fineract's own message when it sent one, else the
 * translated text of key (translated at render)
 */
export type ProductMixError = { key: ProductMixErrorKey; message?: string }

export const apiError = (
  err: unknown,
  key: ProductMixErrorKey
): ProductMixError => {
  const data = (err as AxiosError<ApiErrorResponse>).response?.data
  return {
    key,
    message:
      data?.errors?.[0]?.defaultUserMessage ||
      data?.defaultUserMessage ||
      undefined,
  }
}

/** The products that can be restricted: the ones already restricted, then the rest, as Angular lists them */
export const restrictableProducts = (mix: ProductMix) => [
  ...(mix.restrictedProducts ?? []),
  ...(mix.allowedProducts ?? []),
]
