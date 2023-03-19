const mongoose = require("mongoose");

const Cart = mongoose.model("Cart", {
  date: Date,
  firstName: String,
  lastName: String,
  email: String,
  amount: Number,
  products: Array,
});

module.exports = Cart;
