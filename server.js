const express = require("express");
const requestIp = require("request-ip");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
app.use(cors());
require("dotenv").config();
const moment = require("moment");
const mongoose = require("mongoose");
const User = require('./Schemas/userSchema');
const Budget = require('./Schemas/budgetSchema');
const Expense = require('./Schemas/expanseSchema')
const Category = require('./Schemas/categorySchema')

const JWT_REFRESH_SECRET = "MY_SECRET_KEY";
const JWT_ACCESS_TOKEN_SECRET = "LFSLDJK";
const ACESS_TOKEN_EXPIRY_TIME = 3000;
const REFRESH_TOKEN_EXPIRY_TIME = 888640000;

const refreshTokens = [];

mongoose.connect(
  "mongodb+srv://Harsha_123:gAkwRdGjj0DNFTxh@cluster0.hf8sxwz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
);
const db = mongoose.connection;
db.on("error", (error) => {
  console.error("Connection error:", error);
});
db.once("open", () => {
  console.log("Connected to the database");
});

app.use(express.json());
app.use(requestIp.mw());
app.use(express.urlencoded({ extended: false }));


app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});
app.get("/", (req, res) => {
  res.json({
    message: "Budget Api",
  });
});


app.post('/user/getJwToken', authenticateRequest, (req, res) => {
  try {
    const userData = req.user;
    const JWT_TOKEN = generateAccessToken({
      id: userData.id,
      name: userData.name,
      email: userData.email,
    });
    res.status(200).json({ token: JWT_TOKEN });
  } catch (err) {

    res.status(500).json({ message: err.message });
  }
})

function generateAccessToken(user) {
  return jwt.sign(user, JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: ACESS_TOKEN_EXPIRY_TIME,
  });
}


function generateRefreshToken(user) {
  return jwt.sign(user, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY_TIME,
  });
}


function authenticateRequest(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null)
    return res
      .sendStatus(401)
      .json({ message: "Unauthorized! No Token Found" });



  try {
    const user = jwt.verify(token, JWT_ACCESS_TOKEN_SECRET);
    req.user = user;
    next();
  } catch (err) {
    console.log("Invalid Token ", err.message);
    return res.status(403).json({ message: err.message });
  }
}
app.post('/user/signIn', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exist" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const _user = {
      id: user._id,
      name: user.name,
      email: user.email,
    };
    const token = generateAccessToken(_user);
    const refreshToken = generateRefreshToken(_user);
    refreshTokens.push(refreshToken);

    res.status(200).json({
      refreshToken,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.post('/user/registerUser', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }
    const newUser = new User({
      name,
      email,
      password,
    });
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);
    await newUser.save();

    const _user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
    };
    const token = generateAccessToken(_user);
    const refreshToken = generateRefreshToken(_user);
    res.status(200).json({
      token,
      refreshToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
})



app.get('/budget/getBudgetData', authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId }).populate({
      path: "budgets",
      populate: {
        path: "categories",
        model: "Category",
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allBudgets = user.budgets;

    res.status(200).json(allBudgets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


app.post('/budget/createUserExpanse', authenticateRequest, async (req, res) => {
  try {
    const { categoryId, description, amount, date } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const newExpense = new Expense({
      description,
      amount,
      date: date ? new Date(date) : new Date(),
    });

    const savedExpense = await newExpense.save();

    category.expenses.push(savedExpense._id);
    await category.save();

    res.status(200).json({ message: "Expense added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
})

app.post('/budget/createUserBudget',authenticateRequest, async (req, res) => {
  try {
    let {
      name,
      totalAmount,
      startDate,
      endDate
    } = req.body.budget;
    const newBudget = new Budget({
      name,
      totalAmount,
      startDate: startDate ? startDate : new Date(),
      endDate: endDate ? endDate : new Date(),
    });
    const budgetResponse = await newBudget.save();
    const userId = req.user.id;
    const user = await User.findOne({ _id: userId });
    user.budgets.push(budgetResponse._id);
    await user.save();
    const categories = req.body.budget.categories;
    const allpromises = categories.map(async (category) => {
      const newCategory = new Category({
        name: category.name,
        allocatedAmount: category.amount,
        spend: category.spend ? category.amount : 0,
      });
      const categoryResponse = await newCategory.save();
      newBudget.categories.push(categoryResponse._id);
    });
    await Promise.all(allpromises);
    await newBudget.save();
    res.status(200).send({ message: "Budget created successfully", budget: newBudget });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

app.get('/budget/getAllUsersExpanseData', authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate({
      path: "budgets",
      populate: {
        path: "categories",
        populate: {
          path: "expenses",
          model: "Expense",
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allExpenses = [];
    user.budgets.forEach((budget) => {
      budget.categories.forEach((category) => {
        category.expenses.forEach((expense) => {
          const newExpense = {
            amount: expense.amount,
            date: expense.date,
            description: expense.description,
            _id: expense._id,
            categoryName: category.name,
          };
          allExpenses.push(newExpense);
        });
      });
    });

    res.status(200).json(allExpenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/budget/createBudgetCategory',authenticateRequest, async (req, res) => {
  try {
    const { budgetId, name, allocatedAmount, spend } = req.body;

    if (!budgetId) {
      return res.status(400).json({ message: "Budget ID is required" });
    }

    const budget = await Budget.findById(budgetId);

    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }

    const newCategory = new Category({
      name,
      allocatedAmount,
      spend: spend || 0,
    });

    const savedCategory = await newCategory.save();

    budget.categories.push(savedCategory._id);
    await budget.save();

    res.status(200).json({ message: "Category added to budget successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/budget/deleteUserExpanseData',authenticateRequest, async (req, res) => {
  try {
    const { expenseId } = req.body;

    if (!expenseId) {
      return res.status(400).json({ message: "Expense ID is required" });
    }

    const expense = await Expense.findById(expenseId);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const categoryId = expense.category;

    await Expense.findByIdAndDelete(expenseId);

    const category = await Category.findById(categoryId);
    if (category) {
      category.expenses.pull(expenseId);
      await category.save();
    }

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/budget/deleteBudgetCategory',authenticateRequest, async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: "Category ID is required" });
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const ExpenseIds = category.expenses;

    await Category.findByIdAndDelete(categoryId);

    const budget = await Budget.find({ categories: categoryId });
    if (budget) {
      budget[0].categories.pull(categoryId);
      await budget[0].save();
    }
    await Expense.deleteMany({ _id: { $in: ExpenseIds } });

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/budget/getExpanseAndDateData', authenticateRequest, async (req, res) => {
  try {
    const userId = req.user.id; // Assuming you have a user ID available in req.user

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Find the user by ID, populating budgets
    const user = await User.findById(userId).populate({
      path: "budgets",
      populate: {
        path: "categories",
        populate: {
          path: "expenses",
          model: "Expense",
        },
      },
    });

    // Calculate total amount spent each day
    const dailyExpenses = {};
    user.budgets.forEach((budget) => {
      budget.categories.forEach((category) => {
        category.expenses.forEach((expense) => {
          const formattedDate = moment(expense.date).format("YYYY-MM-DD");

          if (!dailyExpenses[formattedDate]) {
            dailyExpenses[formattedDate] = {
              date: formattedDate,
              totalAmountSpent: 0,
            };
          }

          dailyExpenses[formattedDate].totalAmountSpent += expense.amount;
        });
      });
    });

    const result = Object.values(dailyExpenses);

    res.status(200).json(result);
  } catch (err) {

    res.status(500).json({ message: err.message });
  }
})

app.use((req, res, next) => {
  const error = new Error("Not found");
  error.status = 404;
  next();
});

app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    message: error.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
