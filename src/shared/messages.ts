import type { BullionResolutionResult, LotSearchMetadata, NumistaMarketResult } from './numista';
import type { ExtensionUpdateState } from './update';

export interface FetchLotHtmlRequest {
  readonly type: 'fetch-lot-html';
  readonly lotUrl: string;
}

export interface SetNumistaApiKeyRequest {
  readonly type: 'set-numista-api-key';
  readonly apiKey: string;
}

export interface ResolveNumistaMarketRequest {
  readonly type: 'resolve-numista-market';
  readonly metadata: LotSearchMetadata;
  readonly forceRefresh?: boolean;
  readonly preferredTypeId?: number;
}

export interface ResolveBullionValueRequest {
  readonly type: 'resolve-bullion-value';
  readonly metadata: LotSearchMetadata;
  readonly forceRefresh?: boolean;
}

export interface CheckExtensionUpdateRequest {
  readonly type: 'check-extension-update';
  readonly forceRefresh?: boolean;
}

export type BackgroundRequest =
  | FetchLotHtmlRequest
  | SetNumistaApiKeyRequest
  | ResolveNumistaMarketRequest
  | ResolveBullionValueRequest
  | CheckExtensionUpdateRequest;

export type FetchLotHtmlResponse =
  | { readonly ok: true; readonly html: string }
  | { readonly ok: false; readonly error: string };

export type SetNumistaApiKeyResponse =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

export type ResolveNumistaMarketResponse =
  | { readonly ok: true; readonly result: NumistaMarketResult }
  | { readonly ok: false; readonly error: string };

export type ResolveBullionValueResponse =
  | { readonly ok: true; readonly result: BullionResolutionResult }
  | { readonly ok: false; readonly error: string };

export type CheckExtensionUpdateResponse =
  | { readonly ok: true; readonly result: ExtensionUpdateState }
  | { readonly ok: false; readonly error: string };

export function isFetchLotHtmlRequest(message: unknown): message is FetchLotHtmlRequest {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'fetch-lot-html'
    && typeof (message as { lotUrl?: unknown }).lotUrl === 'string';
}

export function isSetNumistaApiKeyRequest(message: unknown): message is SetNumistaApiKeyRequest {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'set-numista-api-key'
    && typeof (message as { apiKey?: unknown }).apiKey === 'string';
}

export function isResolveNumistaMarketRequest(message: unknown): message is ResolveNumistaMarketRequest {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'resolve-numista-market'
    && typeof (message as { metadata?: { lotUrl?: unknown } }).metadata?.lotUrl === 'string';
}

export function isResolveBullionValueRequest(message: unknown): message is ResolveBullionValueRequest {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'resolve-bullion-value'
    && typeof (message as { metadata?: { lotUrl?: unknown } }).metadata?.lotUrl === 'string';
}

export function isCheckExtensionUpdateRequest(message: unknown): message is CheckExtensionUpdateRequest {
  return typeof message === 'object'
    && message !== null
    && (message as { type?: unknown }).type === 'check-extension-update';
}
