import { z } from "zod";

/**
 * Validation schema for Web Push API subscription registration payload.
 * Enforces strict limits and sanitization on incoming subscription data.
 */
export const pushSubscriptionPayloadSchema = z.object({
  endpoint: z
    .string({
      error: "Endpoint Web Push wajib berupa string.",
    })
    .url("Endpoint Web Push harus berupa URL yang valid.")
    .max(2048, "Panjang endpoint melebihi batas maksimum 2048 karakter.")
    .refine(
      (url) => url.startsWith("https://") || url.startsWith("http://localhost"),
      "Endpoint Web Push wajib menggunakan protokol HTTPS yang aman."
    ),
  keys: z.object(
    {
      p256dh: z
        .string({
          error: "Kunci p256dh wajib diisi.",
        })
        .min(10, "Kunci enkripsi p256dh terlalu pendek.")
        .max(256, "Kunci enkripsi p256dh melebihi batas maksimum 256 karakter."),
      auth: z
        .string({
          error: "Kunci auth secret wajib diisi.",
        })
        .min(10, "Kunci rahasia auth terlalu pendek.")
        .max(128, "Kunci rahasia auth melebihi batas maksimum 128 karakter."),
    },
    {
      error: "Kunci kriptografi keys (p256dh dan auth) wajib disertakan.",
    }
  ),
  user_agent: z
    .string()
    .max(512, "User agent melebihi batas maksimum 512 karakter.")
    .optional(),
});

export type PushSubscriptionPayload = z.infer<typeof pushSubscriptionPayloadSchema>;

/**
 * Validation schema for unsubscribing a Web Push subscription.
 */
export const unsubscribePayloadSchema = z.object({
  endpoint: z
    .string({
      error: "Endpoint Web Push wajib diisi.",
    })
    .url("Endpoint Web Push harus berupa URL yang valid.")
    .max(2048, "Panjang endpoint melebihi batas maksimum 2048 karakter."),
});

export type UnsubscribePayload = z.infer<typeof unsubscribePayloadSchema>;

/**
 * Validation schema for query parameters when inspecting a push subscription via GET.
 */
export const pushEndpointQuerySchema = z.object({
  endpoint: z
    .string({
      error: "Parameter endpoint wajib berupa string.",
    })
    .url("Parameter endpoint harus berupa URL yang valid.")
    .max(2048, "Panjang endpoint melebihi batas maksimum 2048 karakter.")
    .refine(
      (url) => url.startsWith("https://") || url.startsWith("http://localhost"),
      "Parameter endpoint wajib menggunakan protokol HTTPS yang aman."
    ),
});

export type PushEndpointQuery = z.infer<typeof pushEndpointQuerySchema>;
