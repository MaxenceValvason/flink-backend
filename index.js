const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");

const axios = require("axios");
const app = express();
app.use(cors());
app.use(express.json());
mongoose.connect(process.env.MONGODB_URI);

const Cart = require("./models/Cart");
const token = process.env.TOKEN;
const stripe = require("stripe")(process.env.STRIPE);

//fonction qui convertis des degrés en radians
const dtr = (degrees) => {
  return degrees * (Math.PI / 180);
};

//fonction qui calcul la distance entre 2 coordonés gps
const calculateDistance = (lat1, long1, lat2, long2) => {
  const earthRayon = 6371;
  const dLat = dtr(lat2 - lat1);
  const dLon = dtr(long2 - long1);
  const cal =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(dtr(lat1)) *
      Math.cos(dtr(lat2));
  const cal2 = 2 * Math.atan2(Math.sqrt(cal), Math.sqrt(1 - cal));
  const result = earthRayon * cal2;
  return result;
};

//fonction qui calcul le temps de livraison
const calculateDeliveryTime = (distance) => {
  const averageSpeed = 15;
  const time = (distance / averageSpeed) * 3600;

  return time;
};

//fonction qui calcul le temps de préparation
const calculatePreparationTime = (foods) => {
  const time = 15;
  const prepartionTime = foods * time;
  return prepartionTime;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// LOCATION ROUTES
app.get("/locations", async (req, res) => {
  const location = req.query.q;
  try {
    const response = await axios.get(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/locations?q=${location}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/delivery", async (req, res) => {
  const locationUser = req.body.coordinates;
  let locationsHubs = [];
  let isDelivery = false;
  let distance;
  try {
    const response = await axios.get(
      "https://lereacteur-bootcamp-api.herokuapp.com/api/flink/locations/hubs",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    locationsHubs = response.data;
    for (let i = 0; i < locationsHubs.length; i++) {
      const result = calculateDistance(
        locationUser.latitude,
        locationUser.longitude,
        locationsHubs[i].coordinates.latitude,
        locationsHubs[i].coordinates.longitude
      );
      if (result <= 2.5) {
        isDelivery = true;
        distance = result;
      }
    }
    if (isDelivery) {
      res.json({
        isDelivery: true,
        distance: distance,
        message: "Livraison disponnible",
      });
    } else {
      res.json({
        isDelivery: false,
        distance: 0,
        message: "Livraison indisponnible",
      });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/delivery/time", async (req, res) => {
  console.log(req.body);
  const distance = req.body.distance;
  let foods;
  if (req.body.foods) {
    foods = req.body.foods;
  } else {
    foods = 0;
  }
  try {
    const deliveryTime = calculateDeliveryTime(distance);
    const prepartionTime = calculatePreparationTime(foods);
    const total = (deliveryTime + prepartionTime) / 60;

    res.json(total.toFixed(0));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CATEGORIES ROUTES

app.get("/categories/special", async (req, res) => {
  try {
    const tabIsSpecial = [];
    const response = await axios.get(
      "https://lereacteur-bootcamp-api.herokuapp.com/api/flink/categories",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    for (let i = 0; i < response.data.length; i++) {
      if (response.data[i].is_special) {
        tabIsSpecial.push(response.data[i]);
      }
    }

    tabIsSpecial.sort(function (a, b) {
      return a.rank - b.rank;
    });
    res.json(tabIsSpecial);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const tabCategories = [];
    const response = await axios.get(
      "https://lereacteur-bootcamp-api.herokuapp.com/api/flink/categories",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    for (let i = 0; i < response.data.length; i++) {
      if (!response.data[i].parent_id && !response.data[i].is_special) {
        tabCategories.push(response.data[i]);
      }
    }

    tabCategories.sort(function (a, b) {
      return a.rank - b.rank;
    });
    res.json(tabCategories);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/categories/sub/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const tabSubCategories = [];
    const response = await axios.get(
      "https://lereacteur-bootcamp-api.herokuapp.com/api/flink/categories",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    for (let i = 0; i < response.data.length; i++) {
      if (response.data[i].parent_id === id) {
        tabSubCategories.push(response.data[i]);
      }
    }

    tabSubCategories.sort(function (a, b) {
      return a.rank - b.rank;
    });
    res.json(tabSubCategories);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/categories/:slug", async (req, res) => {
  const slug = req.params.slug;
  try {
    const response = await axios.get(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/categories/${slug}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PRODUCTS ROUTES
app.post("/products", async (req, res) => {
  const product_skus = req.body.product_skus;
  try {
    const response = await axios.post(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/products`,
      {
        product_skus,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/products/search", async (req, res) => {
  const name = req.query.q || "";
  const limPage = req.query.page_limit || "50";
  try {
    const response = await axios.get(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/products/search?q=${name}&page_limit=${limPage}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/products/:sku", async (req, res) => {
  const sku = req.params.sku;
  try {
    const response = await axios.get(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/products/${sku}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/product/:slug_sku", async (req, res) => {
  const slug_sku = req.params.slug_sku;
  const tabString = slug_sku.split("-");
  const sku = tabString.slice(-1);
  try {
    const response = await axios.get(
      `https://lereacteur-bootcamp-api.herokuapp.com/api/flink/products/${sku.join()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post("/pay", async (req, res) => {
  console.log(req.body);
  try {
    const response = await stripe.charges.create({
      amount: (req.body.amount * 100).toFixed(0),
      currency: "eur",
      description: "Commande Flink",
      source: req.body.stripeToken,
    });
    console.log(response.status);
    const newCart = new Cart({
      date: req.body.date,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      amount: req.body.amount,
      products: req.body.products,
    });
    await newCart.save();
    res.json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/backoffice", async (req, res) => {
  try {
    const carts = await Cart.find();
    res.json(carts);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.all("*", function (req, res) {
  res.json({ message: "Page not found" });
});

if (process.env.PORT) {
  app.listen(process.env.PORT, () => {
    console.log("Server has started");
  });
} else {
  app.listen(4000, () => {
    console.log("Server started");
  });
}
