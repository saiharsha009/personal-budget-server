const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  allocatedAmount: { type: Number, required: true },
  spend:{type:Number, required: true},
  expenses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Expense' }],
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
