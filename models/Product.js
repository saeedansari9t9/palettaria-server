const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  image: { type: String, required: true }, // Cloudinary URL
  images: [{ type: String }],
  specifications: [{
    key: { type: String, required: true },
    value: { type: String, default: '' },
    _id: false
  }],
  inStock: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  rating: { type: Number, default: 5 },
  reviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
