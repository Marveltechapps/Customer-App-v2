/**
 * API Endpoints
 * Centralized endpoint definitions
 */

/** Paths relative to base URL (base is e.g. http://localhost:5000/api/v1/customer) */
const P = '';

export const endpoints = {
  // Auth endpoints
  auth: {
    login: `${P}/auth/login`,
    // OTP flow
    sendOtp: `${P}/auth/send-otp`,
    verifyOtp: `${P}/auth/verify-otp`,
    resendOtp: `${P}/auth/resend-otp`,
    verifyOTP: `${P}/auth/verify-otp`,
    resendOTP: `${P}/auth/resend-otp`,
    logout: `${P}/auth/logout`,
    refreshToken: `${P}/auth/refresh`,
  },

  // User endpoints
  user: {
    profile: `${P}/user/profile`,
    updateProfile: `${P}/user/profile`,
    changePassword: `${P}/user/change-password`,
  },

  // Product endpoints
  products: {
    list: `${P}/products`,
    detail: (id: string) => `${P}/products/${id}`,
    search: `${P}/products/search`,
    byCategory: (categoryId: string) => `${P}/products/category/${categoryId}`,
  },

  // Category endpoints
  categories: {
    list: `${P}/categories`,
    detail: (id: string) => `${P}/categories/${id}`,
  },

  // Cart endpoints
  cart: {
    get: `${P}/cart`,
    addItem: `${P}/cart/items`,
    /** Update quantity by cart line id; body may include productId/variantId for server fallback. */
    updateItem: (itemId: string) => `${P}/cart/items/${itemId}`,
    /** PUT same path as add — updates by productId + variantId when line id is unknown. */
    updateItemByProduct: `${P}/cart/items`,
    removeItem: (itemId: string) => `${P}/cart/items/${itemId}`,
    clear: `${P}/cart/clear`,
  },

  // Order endpoints
  orders: {
    list: `${P}/orders`,
    active: `${P}/orders/active`,
    detail: (id: string) => `${P}/orders/${id}`,
    create: `${P}/orders`,
    cancel: (id: string) => `${P}/orders/${id}/cancel`,
    rate: (id: string) => `${P}/orders/${id}/rate`,
    status: (id: string) => `${P}/orders/${id}/status`,
    invoice: (id: string) => `${P}/orders/${id}/invoice`,
    reorder: (id: string) => `${P}/orders/${id}/reorder`,
  },

  // Address endpoints
  addresses: {
    list: `${P}/addresses`,
    default: `${P}/addresses/default`,
    create: `${P}/addresses`,
    update: (id: string) => `${P}/addresses/${id}`,
    delete: (id: string) => `${P}/addresses/${id}`,
    setDefault: (id: string) => `${P}/addresses/${id}/default`,
  },

  // Payment endpoints
  payments: {
    methods: `${P}/payments/methods`,
    addMethod: `${P}/payments/methods`,
    removeMethod: (id: string) => `${P}/payments/methods/${id}`,
    setDefault: (id: string) => `${P}/payments/methods/${id}/default`,
    worldline: {
      session: `${P}/payments/worldline/session`,
      complete: `${P}/payments/worldline/complete`,
      status: `${P}/payments/worldline/status`,
    },
  },

  // Coupon endpoints
  coupons: {
    list: `${P}/coupons`,
    validate: `${P}/coupons/validate`,
    redeem: `${P}/coupons/redeem`,
  },

  // Refund endpoints
  refunds: {
    list: `${P}/refunds`,
    detail: (id: string) => `${P}/refunds/${id}`,
    details: (id: string) => `${P}/refunds/${id}/details`,
    request: `${P}/refunds/request`,
  },

  // Notification endpoints
  notifications: {
    list: `${P}/notifications`,
    markRead: (id: string) => `${P}/notifications/${id}/read`,
    markAllRead: `${P}/notifications/read-all`,
    registerToken: `${P}/notifications/register-token`,
    removeToken: `${P}/notifications/remove-token`,
  },

  // Onboarding endpoints
  onboarding: {
    pages: `${P}/onboarding/pages`,
    pageByNumber: (pageNumber: number) => `${P}/onboarding/pages/${pageNumber}`,
    complete: `${P}/onboarding/complete`,
    status: `${P}/onboarding/status`,
  },
 
  // Wallet endpoints
  wallet: {
    balance: `${P}/wallet/balance`,
    transactions: `${P}/wallet/transactions`,
    debit: `${P}/wallet/debit`,
  },

  // Support chat endpoints
  support: {
    tickets: `${P}/support/tickets`,
    activeTicket: (orderNumber?: string) =>
      orderNumber
        ? `${P}/support/tickets/active?orderNumber=${encodeURIComponent(orderNumber)}`
        : `${P}/support/tickets/active`,
    createTicket: `${P}/support/tickets`,
    reopenTicket: (ticketId: string) => `${P}/support/tickets/${ticketId}/reopen`,
    ticketMessages: (ticketId: string) => `${P}/support/tickets/${ticketId}/messages`,
    sendMessage: (ticketId: string) => `${P}/support/tickets/${ticketId}/messages`,
  },

  // Home endpoints
  home: {
    payload: `${P}/home`,
  },

  // Banners (landing page content)
  banner: (id: string) => `${P}/banners/${id}`,

  // Bootstrap (v2 CMS - pages, featureFlags, flowConfig, appConfig)
  bootstrap: `${P}/bootstrap`,

  // App config (fees, tips, support, payment - also in bootstrap)
  appConfig: `${P}/app-config`,

  // Dynamic pages by slug
  page: (slug: string) => `${P}/pages/${slug}`,

  // Collections (by slug or id)
  collection: (slugOrId: string) => `${P}/collections/${slugOrId}`,

  // Store endpoints
  store: {
    assign: `${P}/store/assign`,
    inventory: (storeId: string) => `${P}/store/${storeId}/inventory`,
  },

  // Delivery endpoints
  delivery: {
    estimate: `${P}/delivery/estimate`,
    fee: `${P}/delivery/fee`,
  },

  // FAQ (structured Q&A for Help/Support)
  faq: `${P}/faq`,

  // Legal (Terms, Privacy, login footer config)
  legal: {
    config: `${P}/legal/config`,
    terms: `${P}/legal/terms`,
    privacy: `${P}/legal/privacy`,
    accept: `${P}/legal/accept`,
  },
} as const;

