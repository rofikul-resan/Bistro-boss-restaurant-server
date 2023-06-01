const express = require("express");
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
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
      console.log(authorizeToken);
      if (!authorizeToken) {
        return res
          .status(401)
          .send({ error: true, massage: "unauthorize access no tken" });
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
      console.log(email);
      const user = await usersCollection.findOne({ email: email });
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

    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
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

    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
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

    app.get("/users", async (req, res) => {
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
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port);
