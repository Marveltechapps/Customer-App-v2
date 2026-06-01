/**
 * Route Constants
 * Centralized route name constants
 */

// Main Stack Routes
export const ROUTES = {
  // Auth routes
  SPLASH: 'Splash',
  ONBOARDING: 'Onboarding',
  LOGIN: 'Login',
  OTP_VERIFICATION: 'OTPVerification',
  VERIFICATION_SUCCESS: 'VerificationSuccess',
  
  // Main tabs
  MAIN_TABS: 'MainTabs',
  HOME: 'Home',
  CATEGORIES: 'Categories',
  CART: 'Cart',
  
  // Product routes
  PRODUCT_DETAIL: 'ProductDetail',
  CATEGORY: 'Category',
  CATEGORY_PRODUCTS: 'CategoryProducts',
  CATEGORIES_EXPO: 'CategoriesExpo',
  TINY_TIMMIES: 'TinyTimmies',
  BANNER_DETAIL: 'BannerDetail',
  
  // Cart routes
  CHECKOUT: 'Checkout',
  COUPONS: 'Coupons',
  
  // Order routes
  ORDERS: 'Orders',
  MY_ORDERS: 'MyOrders',
  ORDERS_EXPO: 'OrdersExpo',
  ORDER_STATUS: 'OrderStatus',
  ORDER_STATUS_MAIN: 'OrderStatusMain',
  ORDER_STATUS_DETAILS: 'OrderStatusDetails',
  ORDER_ITEMS_DETAILS: 'OrderItemsDetails',
  ORDER_SUCCESSFUL_DETAILS: 'OrderSuccessfulDetails',
  ORDER_CANCELED_DETAILS: 'OrderCanceledDetails',
  RATE_ORDER: 'RateOrder',
  RATING_SUCCESS: 'RatingSuccess',
  
  // Location routes
  ADDRESSES: 'Addresses',
  SAVED_ADDRESSES_EMPTY: 'SavedAddressesEmpty',
  SAVED_ADDRESSES_LIST: 'SavedAddressesList',
  LOCATION_SEARCH: 'LocationSearch',
  LOCATION_SEARCH_RESULTS: 'LocationSearchResults',
  MAP_ADDRESS_PIN: 'MapAddressPin',
  ENTER_COMPLETE_ADDRESS: 'EnterCompleteAddress',
  ADDRESS_SAVED_SUCCESS: 'AddressSavedSuccess',
  
  // Profile routes
  PROFILE: 'Profile',
  PROFILE_UPDATE_SUCCESS: 'ProfileUpdateSuccess',
  SETTINGS: 'Settings',
  PAYMENT_MANAGEMENT: 'PaymentManagement',
  
  // Support routes
  CUSTOMER_SUPPORT: 'CustomerSupport',
  HELP_SUB_SECTION: 'HelpSubSection',
  
  // General routes
  GENERAL_INFO: 'GeneralInfo',
  TERMS_AND_CONDITIONS: 'TermsAndConditions',
  PRIVACY_POLICY: 'PrivacyPolicy',
  
  // Common routes
  NO_INTERNET: 'NoInternet',
  SEARCH: 'Search',
  SEARCH_RESULTS: 'SearchResults',
  NOTIFICATIONS: 'Notifications',
  
  // Refund routes
  REFUNDS: 'Refunds',
  REFUND_DETAILS: 'RefundDetails',
} as const;

// Tab routes
export const TAB_ROUTES = {
  HOME: 'Home',
  CATEGORIES: 'Categories',
  CART: 'Cart',
} as const;

