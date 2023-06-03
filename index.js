const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send(["Server is running."]);
});
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.BD_PASS}@cluster0.v6yry4e.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "29 Unauthorize user" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.API_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "34 Unauthorize user" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const users = client.db("bistroDB").collection("users");
    const menu = client.db("bistroDB").collection("menu");
    const reviews = client.db("bistroDB").collection("reviews");
    const cartItem = client.db("bistroDB").collection("cartItem");
    const payments = client.db("bistroDB").collection("payments");
    //send data
    app.post("/jwt", (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.API_SECRET, { expiresIn: "5h" });
      res.send({ token });
    });
    /* Make secure
    1.verify jwt
    
    */
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await users.findOne(query);
      if (!user.role === "admin") {
        return res
          .statue(401)
          .send({ error: true, message: "Unauthorize user" });
      }
      next();
    };
    //get all user
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });
    //add user
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const query = { email: userInfo.email };
      const isAlreadyExist = await users.findOne(query);
      if (isAlreadyExist) {
        return res.send({ message: "Already exist" });
      }
      const result = await users.insertOne(userInfo);
      res.send(result);
    });
    //all apis
    app.get("/menu", async (ewq, res) => {
      const result = await menu.find().toArray();
      res.send(result);
    });
    //reviews
    app.get("/reviews", async (req, res) => {
      const result = await reviews.find().toArray();
      res.send(result);
    });
    //get cart added products
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req?.query?.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden access" });
      }
      if (!email) {
        return res.send([]);
      }
      const query = { email: email };
      const result = await cartItem.find(query).toArray();
      res.send(result);
    });
    //add to cart
    app.post("/carts", async (req, res) => {
      const body = req.body;
      const result = await cartItem.insertOne(body);
      res.send(result);
    });
    //delete cart added product
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartItem.deleteOne(query);
      res.send(result);
    });
    //verify admin
    app.get("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(401).send({ admin: false });
      }
      const query = { email: email };
      const user = await users.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    // make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await users.updateOne(query, updateDoc);
      res.send(result);
    });
    //Add menu
    app.post("/menu/add", verifyJWT, verifyAdmin, async (req, res) => {
      const menuData = req.body;
      const result = await menu.insertOne(menuData);
      res.send(result);
    });
    //delete menu
    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menu.deleteOne(query);
      res.send(result);
    });
    //make payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (!price) {
        return;
      }
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //payments
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await payments.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItems.map(id => new ObjectId(id)) },
      };
      const deleteResult = await cartItem.deleteMany(query);
      res.send({ insertResult, deleteResult });
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running at port ${port}`);
});
