const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  // Store Profile
  storeName: { type: String, default: 'Palettaria' },
  tagline: { type: String, default: 'Handmade with love & devotion' },
  announcement: { type: String, default: 'Free shipping on orders above Rs. 2,500 across Pakistan! ✨' },
  contactEmail: { type: String, default: 'palettaria.art@gmail.com' },
  phone: { type: String, default: '0327-8282721' },
  whatsapp: { type: String, default: '0327-8282721' },
  address: { type: String, default: 'Studio Palettaria, Karachi, Pakistan' },
  city: { type: String, default: 'Karachi' },
  currency: { type: String, default: 'PKR' },
  currencySymbol: { type: String, default: 'Rs.' },

  // Shipping & Delivery
  shippingFee: { type: Number, default: 200 },
  freeShippingThreshold: { type: Number, default: 2500 },
  estimatedDeliveryDays: { type: String, default: '3 - 5 business days' },

  // Orders & Advance Payment Policy
  enableCOD: { type: Boolean, default: true },
  enableWhatsAppCheckout: { type: Boolean, default: true },
  advancePaymentRequired: { type: Boolean, default: true },
  advancePercent: { type: Number, default: 50 },

  // Payment Accounts (for customer checkout & receipts)
  jazzCashTitle: { type: String, default: 'Saeed Ansari' },
  jazzCashNumber: { type: String, default: '0327-8282721' },
  easyPaisaTitle: { type: String, default: 'Saeed Ansari' },
  easyPaisaNumber: { type: String, default: '0327-8282721' },
  bankName: { type: String, default: 'Meezan Bank' },
  bankAccountTitle: { type: String, default: 'Saeed Ansari' },
  bankAccountNumber: { type: String, default: '0101-0102030405' },
  bankIban: { type: String, default: 'PK12MEZN0001010102030405' },

  // Social Links
  instagramUrl: { type: String, default: 'https://instagram.com/palettaria' },
  facebookUrl: { type: String, default: '' },

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Setting', settingSchema);
