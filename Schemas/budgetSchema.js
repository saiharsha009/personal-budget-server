const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
});

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
