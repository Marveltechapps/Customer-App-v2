import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Text from '../../common/Text';
import { Theme } from '@/constants/Theme';
import CheckIcon from '../../icons/CheckIcon';
import CancelIcon from '../../icons/CancelIcon';
import ChevronRightIcon from '../../icons/ChevronRightIcon';

interface Order {
  id: string;
  status: 'delivered' | 'cancelled';
  date: string;
  price: string;
  images: (string | number)[]; // string for URLs, number for require() assets
  hasRefund?: boolean;
  actionText: string;
}

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const statusText = order.status === 'delivered' ? 'Order Delivered' : 'Order Cancelled';
  const statusColor = order.status === 'delivered' ? '#00A85A' : '#D7263D';

  return (
    <View style={styles.outerContainer}>
      {/* Single Unified Card */}
      <View style={styles.card}>
        {/* Inner Container with gap 8px */}
        <View style={styles.innerContainer}>
          {/* Content Container with gap 12px */}
          <View style={styles.contentContainer}>
            {/* Images Row */}
            <View style={styles.imagesContainer}>
              {order.images.slice(0, 2).map((image, index) => {
                // Handle different image source types
                let imageSource: any = null;
                
                if (image) {
                  if (typeof image === 'number') {
                    // Local require() asset (static require)
                    imageSource = image;
                  } else if (typeof image === 'string') {
                    if (image.startsWith('http') || image.startsWith('https') || image.startsWith('file://')) {
                      // Remote URL or file URI
                      imageSource = { uri: image };
                    } else if (image.trim() !== '') {
                      // String path - try as URI
                      imageSource = { uri: image };
                    }
                  }
                }

                return (
                  <View key={index} style={styles.imageContainer}>
                    {imageSource ? (
                      <Image 
                        source={imageSource} 
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        {/* Placeholder for product image */}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Delivery Info Container - Row layout that fills horizontally */}
            <View style={styles.deliveryInfoContainer}>
              {/* Status and Date Column - fills available space */}
              <View style={styles.statusDateColumn}>
                {/* Delivery Partner Container - Row with name and icon */}
                <View style={styles.deliveryPartnerContainer}>
                  <View style={styles.deliveryPartnerNameContainer}>
                    <Text style={styles.statusText}>{statusText}</Text>
                    {order.status === 'delivered' ? (
                      <View style={styles.checkIconContainer}>
                        <CheckIcon />
                      </View>
                    ) : (
                      <View style={styles.cancelIconContainer}>
                        <CancelIcon />
                      </View>
                    )}
                  </View>
                </View>
                {/* Delivery Partner Role Container - Date text */}
                <View style={styles.deliveryPartnerRoleContainer}>
                  <Text style={styles.dateText}>{order.date}</Text>
                </View>
              </View>

              {/* Price Row - aligned to the right */}
              <View style={styles.priceRow}>
                <Text style={styles.priceText}>{order.price}</Text>
                <View style={styles.chevronContainer}>
                  <ChevronRightIcon />
                </View>
              </View>
            </View>

            {/* Refund Badge - at content level, after delivery info */}
            {order.hasRefund && (
              <View style={styles.refundBadge}>
                <Text style={styles.refundText}>Refund completed</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Button - Part of the same card */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
          <Text style={styles.actionText}>{order.actionText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: Theme.colors.cardBackground,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: '#F4F4F4',
    overflow: 'hidden',
  },
  innerContainer: {
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contentContainer: {
    gap: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: '#E0F2F1',
    borderRadius: 4,
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  deliveryInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDateColumn: {
    flex: 1,
    gap: 0,
  },
  deliveryPartnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  deliveryPartnerNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deliveryPartnerRoleContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
  statusText: {
    ...Theme.typography.menuItem,
    color: Theme.colors.text,
    fontWeight: '500',
  },
  checkIconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelIconContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#828282',
    fontFamily: 'Inter',
    marginTop: 0,
    marginBottom: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: Theme.colors.text,
    fontFamily: 'Inter',
  },
  chevronContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D7F1D7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 0,
    marginBottom: 0,
  },
  refundText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: '#2C512C',
    fontFamily: 'Inter',
  },
  actionButton: {
    backgroundColor: Theme.colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: '#D1D1D1',
    paddingVertical: 8,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: '#FA7500',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
});

