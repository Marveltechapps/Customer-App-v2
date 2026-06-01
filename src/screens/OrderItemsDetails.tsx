/**
 * Order Items Details Screen
 * 
 * Shows detailed information about an order including:
 * - Order status
 * - List of items with images, names, weights, and prices
 * - Bill summary with savings, charges, and total
 * - Order details (Order ID, Delivery Address, etc.)
 * 
 * @format
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type {
  OrdersStackNavigationProp,
  OrdersStackRouteProp,
  RootStackNavigationProp,
} from '../types/navigation';
import Header from '../components/layout/Header';
import { useAppConfig } from '../contexts/AppConfigContext';
import ChatIconOrder from '../assets/images/chat-icon-order.svg';
import { logger } from '@/utils/logger';
import StatusIconGettingPacked from '../assets/images/status-icon-getting-packed.svg';
import { api } from '../services/api/client';
import { endpoints } from '../services/api/endpoints';

interface OrderItem {
  id: string;
  name: string;
  weight: string;
  quantity: number;
  discountedPrice: number;
  originalPrice: number;
  image?: string;
  itemStatus?: string;
}

interface OrderItemsDetailsParams {
  orderId?: string;
  orderNumber?: string;
  items?: OrderItem[];
  status?: 'getting-packed' | 'on-the-way' | 'arrived';
  deliveryAddress?: string;
  totalSavings?: number;
  itemTotal?: number;
  handlingCharge?: number;
  deliveryFee?: number;
  totalBill?: number;
  createdAt?: string;
}

const formatOrderDate = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${h12}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
};

const OrderItemsDetails: React.FC = () => {
  const route = useRoute<OrdersStackRouteProp<'OrderItemsDetails'>>();
  const navigation = useNavigation<OrdersStackNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const params = route.params || {};
  const { appConfig } = useAppConfig();
  const defaultHandling = appConfig.checkout?.handlingCharge ?? 5;
  const defaultDeliveryFee = appConfig.checkout?.deliveryFee ?? 0;
  const {
    orderId,
    orderNumber,
    items,
    status = 'getting-packed',
    deliveryAddress = 'Delivering to home: 13, 8/22, Dr Muthu Lakshmi nagger',
    totalSavings = 63,
    itemTotal: routeItemTotal = 0,
    handlingCharge: routeHandlingCharge = defaultHandling,
    createdAt,
  } = params;

  // Customer app: force free delivery across the detailed order view.
  const itemTotal = routeItemTotal ?? 0;
  const handlingCharge = routeHandlingCharge ?? defaultHandling;
  const deliveryFee = 0;
  const totalBill = Math.max(0, itemTotal + handlingCharge + deliveryFee);

  // Default items if not provided
  const orderItems: OrderItem[] = items || [
    {
      id: '1',
      name: 'Shimla Apple',
      weight: '500 g',
      quantity: 2,
      discountedPrice: 126,
      originalPrice: 189,
    },
    {
      id: '2',
      name: 'Shimla Apple',
      weight: '500 g',
      quantity: 1,
      discountedPrice: 126,
      originalPrice: 189,
    },
  ];

  const getStatusText = () => {
    switch (status) {
      case 'getting-packed':
        return 'Getting packed';
      case 'on-the-way':
        return 'On the way';
      case 'arrived':
        return 'Arrived';
      default:
        return 'Getting packed';
    }
  };

  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const buildInvoiceHtml = (inv: any): string => {
    const invoiceDeliveryFee = 0;
    const invoiceDiscount = Number(inv.discount || 0);
    const invoiceSubtotal = Number(inv.subtotal || 0);
    const invoiceHandlingCharge = Number(inv.handlingCharge || 0);
    const invoiceTotal = Math.max(0, invoiceSubtotal + invoiceHandlingCharge + invoiceDeliveryFee - invoiceDiscount);

    const itemRows = (inv.items || [])
      .map(
        (item: any) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.name}${item.variantSize ? ` (${item.variantSize})` : ''}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">₹${item.unitPrice}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">₹${item.total}</td>
          </tr>`
      )
      .join('');

    return `
    <html>
    <head><meta charset="utf-8"/><style>
      body{font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:32px;margin:0}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:2px solid #034703;padding-bottom:16px}
      .brand{font-size:22px;font-weight:700;color:#034703}
      .inv-label{font-size:12px;color:#6b6b6b;margin-top:4px}
      .inv-num{font-size:16px;font-weight:600}
      .meta{display:flex;justify-content:space-between;margin-bottom:24px}
      .meta-block{font-size:12px;color:#4c4c4c;line-height:1.6}
      .meta-block strong{color:#1a1a1a}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      thead th{background:#f5f5f5;padding:10px 12px;font-size:11px;font-weight:600;text-transform:uppercase;color:#4c4c4c;text-align:left;border-bottom:2px solid #ddd}
      thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4){text-align:right}
      td{font-size:13px}
      .summary{width:260px;margin-left:auto}
      .summary-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
      .summary-row.total{border-top:2px solid #034703;margin-top:8px;padding-top:8px;font-size:15px;font-weight:700;color:#034703}
      .footer{margin-top:32px;border-top:1px solid #eee;padding-top:12px;font-size:10px;color:#999;text-align:center}
    </style></head>
    <body>
      <div class="header">
        <div>
          <div class="brand">Selorg</div>
          <div class="inv-label">Tax Invoice</div>
        </div>
        <div style="text-align:right">
          <div class="inv-num">${inv.invoiceNumber}</div>
          <div class="inv-label">${formatOrderDate(inv.orderDate)}</div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-block">
          <strong>Order</strong><br/>#${inv.orderNumber}
        </div>
        <div class="meta-block">
          <strong>Payment</strong><br/>${inv.paymentMethod}
        </div>
        <div class="meta-block" style="max-width:200px;text-align:right">
          <strong>Delivery Address</strong><br/>${inv.deliveryAddress}
        </div>
      </div>

      <table>
        <thead><tr>
          <th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span>Subtotal</span><span>₹${inv.subtotal}</span></div>
        <div class="summary-row"><span>Handling Charge</span><span>₹${inv.handlingCharge}</span></div>
        <div class="summary-row"><span>Delivery Fee</span><span>${invoiceDeliveryFee === 0 ? 'Free' : `₹${invoiceDeliveryFee}`}</span></div>
        ${invoiceDiscount ? `<div class="summary-row"><span>Discount</span><span>-₹${invoiceDiscount}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span>₹${invoiceTotal}</span></div>
      </div>

      <div class="footer">
        ${inv.taxInfo?.gstNumber || ''}<br/>
        ${inv.taxInfo?.note || ''}
      </div>
    </body></html>`;
  };

  const handleDownloadInvoice = async () => {
    if (!orderId) {
      Alert.alert('Error', 'Order ID not available');
      return;
    }
    setInvoiceLoading(true);
    try {
      const response = await api.get(endpoints.orders.invoice(orderId));
      const invoiceData = (response as any)?.data ?? response;
      const html = buildInvoiceHtml(invoiceData);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoiceData.invoiceNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      logger.error('Invoice download failed', err);
      Alert.alert('Error', 'Failed to download invoice. Please try again.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const renderStatusCard = () => {
    return (
      <View style={styles.statusCard}>
        <View style={styles.statusImageContainer}>
          <StatusIconGettingPacked width={40} height={40} />
        </View>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
    );
  };

  const renderOrderItem = (item: OrderItem) => {
    return (
      <View key={item.id} style={styles.orderItemCard}>
        <View style={styles.imageContainer}>
          <Image
            source={require('../assets/images/product-image-item-1.png')}
            style={styles.productImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.itemDetailsContainer}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productWeight}>{item.weight}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.discountedPrice}>₹{item.discountedPrice}</Text>
            <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBillSummary = () => {
    const itemTotalOriginal = orderItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );

    return (
      <View style={styles.billSummaryCard}>
        {/* Header with border bottom */}
        <View style={styles.billSummaryHeader}>
          <Text style={styles.billSummaryTitle}>Bill Summary</Text>
          <View style={styles.savedBadge}>
            <Text style={styles.savedText}>Saved₹{totalSavings}</Text>
          </View>
        </View>

        {/* Bill Items Container with border bottom */}
        <View style={styles.billItemsContainer}>
          <View style={styles.billItem}>
            <View style={styles.billItemLabelContainer}>
              <Text style={styles.billItemLabel}>Item Total & GST</Text>
              <View style={styles.infoBadge}>
                <Text style={styles.infoText}>i</Text>
              </View>
            </View>
            <View style={styles.billItemValueContainer}>
              <Text style={styles.billItemOriginalPrice}>₹{itemTotalOriginal}</Text>
              <Text style={styles.billItemPrice}>₹{itemTotal}</Text>
            </View>
          </View>

          <View style={styles.billItem}>
            <Text style={styles.billItemLabelSecondary}>Handling charge</Text>
            <Text style={styles.billItemPriceSecondary}>₹{handlingCharge.toString().padStart(2, '0')}</Text>
          </View>

          <View style={styles.billItem}>
            <Text style={styles.billItemLabelSecondary}>Delivery Fee</Text>
            <Text style={styles.billItemPriceSecondary}>
              {deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}
            </Text>
          </View>
        </View>

        {/* Total Bill Container */}
        <View style={styles.totalBillContainer}>
          <Text style={styles.totalBillLabel}>Total bill</Text>
          <Text style={styles.totalBillPrice} numberOfLines={1} ellipsizeMode="clip">
            ₹{totalBill}
          </Text>
        </View>

        {/* Invoice Button Container with border top */}
        <View style={styles.invoiceContainer}>
          <TouchableOpacity
            style={[styles.invoiceButton, invoiceLoading && { opacity: 0.6 }]}
            onPress={handleDownloadInvoice}
            activeOpacity={0.7}
            disabled={invoiceLoading}
          >
            {invoiceLoading ? (
              <ActivityIndicator size="small" color="#034703" />
            ) : (
              <Text style={styles.invoiceButtonText}>Download Invoice</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOrderDetails = () => {
    const orderPlacedDate = formatOrderDate(createdAt);

    return (
      <View style={styles.orderDetailsCard}>
        <Text style={styles.orderDetailsTitle}>Order Details</Text>
        <View style={styles.orderDetailsContainer}>
          <View style={styles.orderDetailItem}>
            <View style={styles.orderDetailLabelContainer}>
              <Text style={styles.orderDetailLabel}>Order ID</Text>
            </View>
            <View style={styles.orderDetailValueContainer}>
              <Text style={styles.orderDetailValue}>
                {orderNumber ? `#${orderNumber}` : orderId ? `#${orderId}` : 'N/A'}
              </Text>
            </View>
          </View>
          <View style={styles.orderDetailItem}>
            <View style={styles.orderDetailLabelContainer}>
              <Text style={styles.orderDetailLabel}>Delivery Address</Text>
            </View>
            <View style={styles.orderDetailValueContainer}>
              <Text style={styles.orderDetailValue}>{deliveryAddress}</Text>
            </View>
          </View>
          <View style={styles.orderDetailItem}>
            <View style={styles.orderDetailLabelContainer}>
              <Text style={styles.orderDetailLabel}>Order Placed</Text>
            </View>
            <View style={styles.orderDetailValueContainer}>
              <Text style={styles.orderDetailValue}>{orderPlacedDate}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const missingItems = orderItems.filter(i => i.itemStatus === 'not_found');
  const availableItems = orderItems.filter(i => i.itemStatus !== 'not_found');
  const adjustedTotal = availableItems.reduce((sum, i) => sum + i.discountedPrice * i.quantity, 0);

  const renderMissingItemsSection = () => {
    if (missingItems.length === 0) return null;
    return (
      <View style={styles.missingSection}>
        <View style={styles.missingBanner}>
          <Text style={styles.missingBannerText}>{missingItems.length} item{missingItems.length > 1 ? 's' : ''} unavailable</Text>
        </View>
        {missingItems.map((item) => (
          <View key={`missing-${item.id}`} style={styles.orderItemCard}>
            <View style={styles.imageContainer}>
              <Image
                source={require('../assets/images/product-image-item-1.png')}
                style={[styles.productImage, { opacity: 0.5 }]}
                resizeMode="cover"
              />
            </View>
            <View style={styles.itemDetailsContainer}>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, styles.strikethrough]}>{item.name}</Text>
                <Text style={styles.productWeight}>{item.weight}</Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={[styles.discountedPrice, styles.strikethrough]}>₹{item.discountedPrice}</Text>
              </View>
            </View>
          </View>
        ))}
        {totalBill > 0 && (
          <View style={styles.adjustedTotalRow}>
            <Text style={styles.adjustedLabel}>Adjusted Total</Text>
            <View style={styles.adjustedValues}>
              <Text style={styles.adjustedOriginal}>₹{totalBill}</Text>
              <Text style={styles.adjustedNew}>₹{adjustedTotal + handlingCharge + deliveryFee}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const handleNeedHelp = () => {
    rootNavigation.navigate('CustomerSupport', { orderId });
  };

  const renderHelpCard = () => {
    return (
      <TouchableOpacity style={styles.helpCard} onPress={handleNeedHelp} activeOpacity={0.7}>
        <View style={styles.helpContent}>
          <View style={styles.helpIconContainer}>
            <ChatIconOrder width={40} height={40} style={{ width: 40, height: 40 }} />
          </View>
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Need help with this order?</Text>
            <Text style={styles.helpSubtitle}>
              Chat with us now — we're just a tap away
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Order Details" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Status Card */}
          {renderStatusCard()}

          {/* Items Section */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>
              {orderItems.length} Items in Order
            </Text>
            <View style={styles.itemsList}>
              {orderItems.map((item) => renderOrderItem(item))}
            </View>
          </View>

          {/* Missing Items */}
          {renderMissingItemsSection()}

          {/* Bill Summary */}
          {renderBillSummary()}

          {/* Order Details */}
          {renderOrderDetails()}

          {/* Help Card */}
          {renderHelpCard()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12, // Exact gap from Figma layout_6V21DH
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Exact gap from Figma layout_JGG3VS
  },
  statusImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#FFE9DA', // Exact color from Figma fill_YALJ0S
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  statusText: {
    fontSize: 18, // Exact from Figma style_38789W
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 26, // 1.4444444444444444em
  },
  itemsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    gap: 12, // Exact gap from Figma layout_842RFA
  },
  sectionTitle: {
    fontSize: 14, // Exact from Figma style_FTHETL
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_C8SL8Z
    lineHeight: 20, // 1.4285714285714286em
  },
  itemsList: {
    gap: 8, // Exact gap from Figma layout_DEU20Q
  },
  orderItemCard: {
    flexDirection: 'row',
    gap: 8, // Exact gap from Figma layout_DEU20Q
    alignItems: 'center',
  },
  imageContainer: {
    width: 56, // Exact from Figma layout_KVV7NL
    height: 56, // Exact from Figma layout_KVV7NL
    borderRadius: 8, // Exact from Figma
    overflow: 'hidden',
    // Gradient background: linear-gradient(180deg, rgba(224, 242, 241, 1) 0%, rgba(245, 245, 245, 1) 100%)
    backgroundColor: '#E0F2F1', // Fallback color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2, // Android shadow
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  itemDetailsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productInfo: {
    flex: 1,
    gap: 0,
  },
  productName: {
    fontSize: 12, // Exact from Figma style_S82YP0
    fontWeight: '500',
    color: '#1A1A1A', // Exact from Figma fill_C8SL8Z
    lineHeight: 18, // 1.5em
  },
  productWeight: {
    fontSize: 12, // Exact from Figma style_6PM8PP
    fontWeight: '400',
    color: '#6B6B6B', // Exact from Figma fill_5S75V0
    lineHeight: 16, // 1.3333333333333333em
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Exact from Figma layout_BA3BLI
    marginLeft: 'auto',
  },
  discountedPrice: {
    fontSize: 14, // Exact from Figma style_UJBVP2
    fontWeight: '500',
    color: '#1A1A1A', // Exact from Figma fill_C8SL8Z
    lineHeight: 20, // 1.4285714285714286em
  },
  originalPrice: {
    fontSize: 12, // Exact from Figma style_6PM8PP
    fontWeight: '400',
    color: '#6B6B6B', // Exact from Figma fill_5S75V0
    textDecorationLine: 'line-through',
    lineHeight: 16, // 1.3333333333333333em
  },
  billSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 0,
  },
  billSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8, // Exact from Figma layout_ULLVDF
    paddingHorizontal: 16, // Exact from Figma layout_ULLVDF
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D1', // Exact from Figma stroke_W5IWHD
  },
  billSummaryTitle: {
    fontSize: 14, // Exact from Figma style_08NZ63
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_UR1F4M
    lineHeight: 20, // 1.4285714285714286em
  },
  savedBadge: {
    backgroundColor: '#D7F1D7', // Exact from Figma fill_I27OZS
    borderRadius: 4,
    paddingHorizontal: 16, // Exact from Figma layout_SVE4LZ
    paddingVertical: 8, // Exact from Figma layout_SVE4LZ
  },
  savedText: {
    fontSize: 12, // Exact from Figma style_Z4HLMA
    fontWeight: '500',
    color: '#2C512C', // Exact from Figma fill_U6IR3Q
    lineHeight: 18, // 1.5em
    textAlignVertical: 'center',
  },
  billItemsContainer: {
    paddingVertical: 12, // Exact from Figma layout_4V63KD
    paddingHorizontal: 16, // Exact from Figma layout_4V63KD
    gap: 4, // Exact from Figma layout_4V63KD
    borderBottomWidth: 1,
    borderBottomColor: '#D1D1D1', // Exact from Figma stroke_W5IWHD
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  billItemLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5, // Exact from Figma layout_BUW6MT
  },
  billItemLabel: {
    fontSize: 12, // Exact from Figma style_PPMBZD for Item Total
    fontWeight: '400',
    color: '#6B6B6B', // Exact from Figma fill_JZJRBT
    lineHeight: 18, // 1.5em
  },
  billItemLabelSecondary: {
    fontSize: 12, // Exact from Figma style_GF3PS9 for handling/delivery
    fontWeight: '400',
    color: '#6B6B6B', // Exact from Figma fill_JZJRBT
    lineHeight: 19.2, // 1.6000000635782878em
  },
  infoBadge: {
    width: 9, // Exact from Figma layout_X26KY4
    height: 9, // Exact from Figma layout_X26KY4
    borderRadius: 4.5, // Perfect circle
    backgroundColor: '#E0F2F1', // Exact from Figma fill_0XUKER
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 9,
    minHeight: 9,
  },
  infoText: {
    fontSize: 5.5, // Exact from Figma style_CPKXB1
    fontWeight: '400',
    color: '#1A1A1A',
    lineHeight: 5.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  billItemValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5, // Exact from Figma layout_V8F0F2
  },
  billItemOriginalPrice: {
    fontSize: 10, // Exact from Figma style_9S2Y94
    fontWeight: '400',
    color: '#6B6B6B', // Exact from Figma fill_JZJRBT
    textDecorationLine: 'line-through',
    lineHeight: 14, // 1.4em
    width: 27, // Exact from Figma layout_HLXVMS
    textAlign: 'right',
  },
  billItemPrice: {
    fontSize: 10, // Exact from Figma style_PPMBZD for item total discounted
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_UR1F4M
    lineHeight: 18, // 1.5em
    width: 27, // Exact from Figma layout_HLXVMS
    textAlign: 'right',
  },
  billItemPriceSecondary: {
    fontSize: 12, // Exact from Figma style_WDTFF8 for handling/delivery
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_UR1F4M
    lineHeight: 16, // 1.3333333333333333em
    textAlign: 'left',
  },
  totalBillContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8, // Exact from Figma layout_T66AH3
    paddingHorizontal: 16, // Exact from Figma layout_T66AH3
  },
  totalBillLabel: {
    fontSize: 12, // Exact from Figma style_PPMBZD
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_UR1F4M
    lineHeight: 18, // 1.5em
  },
  totalBillPrice: {
    fontSize: 14, // Exact from Figma style_813L5N
    fontWeight: '500', // Exact from Figma
    color: '#1A1A1A', // Exact from Figma fill_SQT3HW
    lineHeight: 20, // 1.4285714285714286em
    minWidth: 30, // Exact from Figma layout_BUL4AC (using minWidth to allow single line)
    flexShrink: 0, // Prevent shrinking
  },
  invoiceContainer: {
    paddingVertical: 8, // Exact from Figma layout_GO2OPM
    paddingHorizontal: 16, // Exact from Figma layout_GO2OPM
    borderTopWidth: 1,
    borderTopColor: '#D1D1D1', // Exact from Figma stroke_L4FTFV
    alignItems: 'flex-end', // Exact from Figma layout_GO2OPM
  },
  invoiceButton: {
    backgroundColor: '#CDE19A', // Exact from Figma fill_RZQI5Z
    borderRadius: 4,
    paddingVertical: 0,
    paddingHorizontal: 8, // Exact from Figma layout_MHBJ36
    height: 32, // Exact from Figma layout_MHBJ36
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2, // Exact from Figma layout_MHBJ36
  },
  invoiceButtonText: {
    fontSize: 10, // Exact from Figma style_PY5NOE
    fontWeight: '500',
    color: '#034703', // Exact from Figma primary
    lineHeight: 14, // 1.4em
    textAlignVertical: 'center',
  },
  orderDetailsCard: {
    backgroundColor: '#FFFFFF', // Exact from Figma fill_R8I57C
    borderRadius: 8,
    padding: 12, // Exact from Figma layout_C0267J
    paddingHorizontal: 16, // Exact from Figma layout_C0267J
    gap: 12, // Exact from Figma layout_C0267J
  },
  orderDetailsTitle: {
    fontSize: 16, // Exact from Figma style_LPM5KX
    fontWeight: '400',
    color: '#1A1A1A', // Exact from Figma fill_IOS8PB
    lineHeight: 24, // 1.5em
  },
  orderDetailsContainer: {
    gap: 8, // Exact from Figma layout_ONLZ3P
  },
  orderDetailItem: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 0,
  },
  orderDetailLabelContainer: {
    width: '100%',
    minHeight: 20, // Exact from Figma layout_IZGRBG
    justifyContent: 'center',
  },
  orderDetailLabel: {
    fontSize: 14, // Exact from Figma style_PHRPL0
    fontWeight: '500',
    color: '#4C4C4C', // Exact from Figma fill_Z66K6L
    lineHeight: 20, // 1.4285714285714286em
    includeFontPadding: false,
  },
  orderDetailValueContainer: {
    width: '100%',
    minHeight: 20, // Exact from Figma layout_IZGRBG
    justifyContent: 'center',
  },
  orderDetailValue: {
    fontSize: 12, // Exact from Figma style_RHUSLL
    fontWeight: '400',
    color: '#4E4E4E', // Exact from Figma fill_5O6DMB
    lineHeight: 18, // 1.5em
    includeFontPadding: false,
  },
  missingSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  missingBanner: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  missingBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#828282',
  },
  adjustedTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F4',
  },
  adjustedLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  adjustedValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adjustedOriginal: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
    textDecorationLine: 'line-through',
  },
  adjustedNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#034703',
  },
  helpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
  },
  helpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helpIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  helpTextContainer: {
    flex: 1,
    gap: 4,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  helpSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#828282',
  },
});

export default OrderItemsDetails;

