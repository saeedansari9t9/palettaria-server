const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true }, // custom ID like PAL-1001
  customer: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  items: [
    {
      id: String,
      name: String,
      price: Number,
      qty: Number,
      specifications: Array
    }
  ],
  total: { type: Number, required: true },
  advanceAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  paymentStatus: { type: String, enum: ['paid', 'unpaid', 'pending_verification', 'advance_received'], default: 'unpaid' },
  paymentMethod: { type: String },
  note: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
