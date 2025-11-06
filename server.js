const express = require('express');
const mysql = require('mysql2');
const cors = require('cors'); 

const server = express();
const port = 1945;
server.use(express.json());
server.use(cors());
server.listen(port, () => {
    console.log(`Server is running with `, port);
})

const db = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'user123',
    database: 'store_db_b',
});

db.connect(() => {
    console.log('store_db_b is connected!');
});


// List all products
server.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json(result);
    });
});
// Search products by price range
server.get('/api/products/search', (req, res) => {
    const min = parseFloat(req.query.minprice), max = parseFloat(req.query.maxprice);

    // Validate query parameters
    if (Number.isNaN(min) || Number.isNaN(max)) {
        return res.status(400).json({ error: 'minprice and maxprice must be valid numbers' });
    }
    if (min > max) {
        return res.status(400).json({ error: 'minprice cannot be greater than maxprice' });
    }

    db.query(
        'SELECT * FROM products WHERE price >= ? AND price <= ?',
        [min, max],
        (error, result) => {
            if (error) return res.status(500).json({ error: error.message });
            res.json(result);
        }
    );
});

// Get products with category_name and supplier_name (joined details)
server.get('/api/products/details', (req, res) => {
    const sql = `SELECT prod.product_id,
                        prod.product_name,
                        prod.price,
                        prod.stock_quantity,
                        cat.category_name,
                        sup.supplier_name
                 FROM products prod
                 LEFT JOIN categories cat ON prod.category_id = cat.category_id
                 LEFT JOIN suppliers sup ON prod.supplier_id = sup.supplier_id`;

    db.query(sql, (error, results) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json(results);
    });
});

// Get a single product by ID
server.get('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid product id' });

    db.query('SELECT * FROM products WHERE product_id = ?', [id], (error, results) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!results || results.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(results[0]);
    });
});

// Create a new product
server.post('/api/products', (req, res) => {
    // Accept required and optional fields
    const { product_name, price, stock_quantity, category_id, supplier_id } = req.body;

    if (!product_name || price === undefined) {
        return res.status(400).json({ error: 'product_name and price are required' });
    }
    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'price must be a number' });
    }

    // Build INSERT dynamically so optional fields can be omitted
    const columns = ['product_name', 'price'];
    const placeholders = ['?', '?'];
    const values = [product_name, parsedPrice];

    if (stock_quantity !== undefined) {
        columns.push('stock_quantity');
        placeholders.push('?');
        values.push(stock_quantity);
    }
    if (category_id !== undefined) {
        columns.push('category_id');
        placeholders.push('?');
        values.push(category_id);
    }
    if (supplier_id !== undefined) {
        columns.push('supplier_id');
        placeholders.push('?');
        values.push(supplier_id);
    }

    const sql = `INSERT INTO products (${columns.join(',')}) VALUES (${placeholders.join(',')})`;

    db.query(sql, values, (error, result) => {
        if (error) return res.status(500).json({ error: error.message });

        // Return the full created row
        db.query('SELECT * FROM products WHERE product_id = ?', [result.insertId], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            if (!rows || rows.length === 0) return res.status(500).json({ error: 'Failed to retrieve created product' });
            return res.status(201).json(rows[0]);
        });
    });
});

// Update an existing product
server.put('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid product id' });
    const data = req.body;

    // Reject empty update bodies which would produce invalid SQL
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No fields provided to update' });
    }

    // Prevent updates to the primary key
    if (data.product_id !== undefined) delete data.product_id;

    db.query('UPDATE products SET ? WHERE product_id = ?', [data, id], (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.json({ affectedRows: result.affectedRows });
    });
});

// Delete a product by ID
server.delete('/api/products/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) return res.status(400).json({ error: 'Invalid product id' });

    db.query('DELETE FROM products WHERE product_id = ?', [id], (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        return res.json({ deletedId: id });
    });
});
