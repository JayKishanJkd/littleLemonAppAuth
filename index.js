const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// PostgreSQL database configuration
const pool = new Pool({
  connectionString: 'postgresql://ultv6k63uq36vroaucej:RtVoGYJLt04avjXaTrcp7v5xDW04l4@b17shpbqy6dfakrwipw9-postgresql.services.clever-cloud.com:50013/b17shpbqy6dfakrwipw9',
});

app.use(cors());

app.use(bodyParser.json());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: ' this is updated testing for kamal daiya' });
  });

  let menuItems = [];

  // Endpoint to get all menu items
  app.get('/api/menuItems', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM menu_items');
      const menuItems = result.rows;
      res.json(menuItems);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  // Endpoint to add an item to the cart and store it in the database
  app.post('/cart', async (req, res) => {
    const { serial_number, quantity } = req.body;
    const menuItem = menuItems.find((item) => item.serial_number === serial_number);
  
    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
  
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // Insert the item into the cart table
      const result = await client.query(
        'INSERT INTO littleLemon.cart (serial_number, name, category, price_inr, description, quantity) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [
          menuItem.serial_number,
          menuItem.name,
          menuItem.category,
          menuItem.price_inr,
          menuItem.description,
          quantity,
        ]
      );
  
      await client.query('COMMIT');
  
      const cartItem = result.rows[0];
      res.json({ success: true, message: 'Item added to the cart', cartItem });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  });
  
  // Endpoint to get the items in the cart from the database
  app.get('/cart', async (req, res) => {
    const client = await pool.connect();
  
    try {
      const result = await client.query('SELECT * FROM littleLemon.cart');
      const cartItems = result.rows;
      res.json(cartItems);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
      client.release();
    }
  });
// Sign-up endpoint
app.post('/signup', async (req, res) => {
  const { username, password, email } = req.body;

  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the user into the database
    const query = `
      INSERT INTO littleLemon.user_authentication (username, password_hash, email)
      VALUES ($1, $2, $3)
      RETURNING user_id`;
    
    const values = [username, hashedPassword, email];
    const result = await pool.query(query, values);

    const userId = result.rows[0].user_id;

    res.status(201).json({ userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve user information from the database
    const query = `
    SELECT user_id, password_hash
    FROM littleLemon.user_authentication
    WHERE username = $1`;
    
    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error : "user not found" });
    }

    const user = result.rows[0];

    // Compare the provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate a JWT token for the user
    const token = jwt.sign({ userId: user.user_id }, 'your_secret_key_here');

    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
});

app.get('/menu_items', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT serial_number, category, name, price_inr, description FROM littleLemon.menu_items');
    const menuItems = result.rows;
    client.release();
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
