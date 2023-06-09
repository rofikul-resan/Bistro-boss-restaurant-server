const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();
const jwt = require("jsonwebtoken");

//middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server is running ");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.absippg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    app.post("/jwt", (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.JWT_SECRET, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    const verifyJWT = (req, res, next) => {
      const authorizeToken = req.headers.authorization;
      if (!authorizeToken) {
        return res
          .status(401)
          .send({ error: true, massage: "unauthorize access no token" });
      }
      const token = authorizeToken.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
        if (error) {
          return res
            .status(401)
            .send({ error: true, message: "unauthorized access wrong token " });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email: email });
      console.log(user);
      if (user.roll === "admin") {
        console.log(true);
        next();
      } else {
        res.status(403).send({ admin: false });
      }
    };
    const menuCollection = client.db("bistro-Boss").collection("menu");
    const reviewCollection = client.db("bistro-Boss").collection("review");
    const cartsCollection = client.db("bistro-Boss").collection("carts");
    const usersCollection = client.db("bistro-Boss").collection("users");
    const paymentCollection = client.db("bistro-Boss").collection("payment");

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/category/:title", async (req, res) => {
      const title = req.params.title.toLowerCase();
      const query = { category: title };
      const result = await menuCollection.find(query).toArray();
      res.send(result);
    });

    // users section

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const email = userInfo?.email;
      const isHaveUser = await usersCollection.findOne({ email: email });
      if (!isHaveUser) {
        const result = await usersCollection.insertOne({
          name: userInfo.name,
          email: userInfo.email,
        });
        res.send(result);
      }
    });

    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const doc = {
        $set: {
          roll: "admin",
        },
      };
      const result = await usersCollection.updateOne(query, doc);
      res.send(result);
    });

    app.get("/users/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const result = await usersCollection.findOne({ email: email });
      res.send(result);
    });

    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // cart section

    app.post("/carts", async (req, res) => {
      const doc = req.body;
      const result = await cartsCollection.insertOne(doc);
      res.send(result);
    });

    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });

    // payment section

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const query = {
        _id: { $in: payment.orderItemId.map((id) => new ObjectId(id)) },
      };
      const insertResult = await paymentCollection.insertOne(payment);
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ insertResult, deleteResult });
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: +amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      console.log(paymentIntent.client_secret);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/admin-status", async (req, res) => {
      const totalUser = await usersCollection.estimatedDocumentCount();
      const totalOrder = await paymentCollection.estimatedDocumentCount();
      const totalMenu = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.find().toArray();
      const revenue = orders.reduce((sum, payment) => sum + payment.amount, 0);

      res.send({
        totalUser,
        totalOrder,
        totalMenu,
        revenue,
      });
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port);
