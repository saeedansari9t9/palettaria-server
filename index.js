const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Product = require('./models/Product');
const Order = require('./models/Order');
const Category = require('./models/Category');
const { upload } = require('./utils/cloudinary');

const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Setting = require('./models/Setting');

app.use(cors());
app.use(express.json());

// ── Auth Middleware ──────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
};

// ── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters' });
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // First user or specific email can be admin
    const role = (email === 'admin@palettaria.com') ? 'admin' : 'user';
    
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.status(201).json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      user.email = email;
    }
    if (name && name.trim()) {
      user.name = name.trim();
    }
    await user.save();
    res.json({ user: { name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Category Seeding ────────────────────────────────────────────────────────
const seedCategories = async () => {
  try {
    const defaults = ['Clay Art', 'Paintings', 'Islamic Art'];
    const productCategories = await Product.distinct('category');
    const allToEnsure = Array.from(new Set([...defaults, ...productCategories.filter(Boolean)]));
    for (const name of allToEnsure) {
      const exists = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!exists) {
        await Category.create({ name });
      }
    }
  } catch (err) {
    console.error('Error seeding categories:', err);
  }
};

// ── MongoDB Connection ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedCategories();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// ── Category Routes ──────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const cleanName = name.trim();
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    const category = new Category({
      name: cleanName,
      description: description ? description.trim() : '',
      icon: icon ? icon.trim() : ''
    });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/categories/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    if (name && name.trim()) {
      const oldName = category.name;
      const cleanName = name.trim();
      if (cleanName.toLowerCase() !== oldName.toLowerCase()) {
        const duplicate = await Category.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
        if (duplicate) return res.status(400).json({ error: 'Category with this name already exists' });
      }
      category.name = cleanName;
      // Cascade update existing products under this category
      await Product.updateMany({ category: oldName }, { category: cleanName });
    }
    if (description !== undefined) category.description = description.trim();
    if (icon !== undefined) category.icon = icon.trim();
    await category.save();
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Product Routes ───────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticate, isAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, category, price, originalPrice, featured, inStock } = req.body;
    const imageUrls = req.files ? req.files.map(f => f.path) : [];
    if (imageUrls.length === 0) return res.status(400).json({ error: 'At least 1 image is required' });

    let specifications = [];
    if (req.body.specifications) {
      try {
        const parsed = typeof req.body.specifications === 'string'
          ? JSON.parse(req.body.specifications)
          : req.body.specifications;
        if (Array.isArray(parsed)) {
          specifications = parsed
            .filter(item => item && item.key && String(item.key).trim() !== '' && item.value && String(item.value).trim() !== '')
            .map(item => ({ key: String(item.key).trim(), value: String(item.value).trim() }));
        }
      } catch (err) {
        console.error('Error parsing specifications in post:', err);
      }
    }

    const newProduct = new Product({
      name,
      description,
      category,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      image: imageUrls[0], // Cloudinary URL
      images: imageUrls,
      specifications,
      featured: featured === 'true',
      inStock: inStock === 'true',
      active: true
    });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/products/:id', authenticate, isAdmin, upload.array('images', 5), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(f => f.path);
      updates.image = updates.images[0];
    }
    
    // Convert string booleans/numbers from FormData
    if (updates.featured !== undefined) updates.featured = String(updates.featured) === 'true';
    if (updates.inStock !== undefined) updates.inStock = String(updates.inStock) === 'true';
    if (updates.active !== undefined) updates.active = String(updates.active) === 'true';
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.originalPrice !== undefined) updates.originalPrice = Number(updates.originalPrice);

    if (updates.specifications !== undefined) {
      try {
        const parsed = typeof updates.specifications === 'string'
          ? JSON.parse(updates.specifications)
          : updates.specifications;
        if (Array.isArray(parsed)) {
          updates.specifications = parsed
            .filter(item => item && item.key && String(item.key).trim() !== '' && item.value && String(item.value).trim() !== '')
            .map(item => ({ key: String(item.key).trim(), value: String(item.value).trim() }));
        } else {
          updates.specifications = [];
        }
      } catch (err) {
        console.error('Error parsing specifications in patch:', err);
      }
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/products/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Order Routes ─────────────────────────────────────────────────────────────
app.get('/api/orders', authenticate, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    // Simple ID generation logic or handle PAL-1001 on frontend/backend
    const newOrder = new Order(orderData);
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.advanceAmount !== undefined) {
      updates.advanceAmount = Number(updates.advanceAmount) || 0;
    }
    const order = await Order.findOneAndUpdate({ id: req.params.id }, updates, { new: true });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await Order.findOneAndDelete({ id: req.params.id });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── User Management Routes ───────────────────────────────────────────────────
app.get('/api/users', authenticate, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const orders = await Order.find().sort({ createdAt: -1 });

    // Correlate users with their orders
    const enrichedUsers = users.map(user => {
      const uObj = user.toObject();
      const userEmail = (uObj.email || '').toLowerCase().trim();
      
      const userOrders = orders.filter(o => 
        o.email && o.email.toLowerCase().trim() === userEmail
      );

      const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const ordersCount = userOrders.length;
      const lastOrder = userOrders[0] || null;

      return {
        ...uObj,
        ordersCount,
        totalSpent,
        lastOrder: lastOrder ? {
          id: lastOrder.id,
          total: lastOrder.total,
          status: lastOrder.status,
          paymentStatus: lastOrder.paymentStatus,
          createdAt: lastOrder.createdAt
        } : null,
        orders: userOrders.map(o => ({
          id: o.id,
          total: o.total,
          status: o.status,
          paymentStatus: o.paymentStatus,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
          itemsCount: o.items?.length || 0,
          items: o.items || []
        }))
      };
    });

    res.json(enrichedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: role === 'admin' ? 'admin' : 'user'
    });
    await newUser.save();

    res.status(201).json({
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      ordersCount: 0,
      totalSpent: 0,
      lastOrder: null,
      orders: []
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Store Settings Routes ────────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', authenticate, isAdmin, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting(req.body);
    } else {
      Object.assign(settings, req.body, { updatedAt: new Date() });
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
