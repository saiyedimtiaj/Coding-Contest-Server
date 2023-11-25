const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xslrw3a.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyUser = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthoridze Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forviden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userColluction.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

const verifyCreator = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userColluction.findOne(query);
  const isCreator = user?.role === "creator";
  if (!isCreator) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const courseColluction = client.db("course-contest").collection("courses");
    const userColluction = client.db("course-contest").collection("user");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ message: "sucess" });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ message: true });
    });

    app.get("/courses", async (req, res) => {
      const sortObj = {};
      const catObj = {};
      const nameObj = {};
      const sortBy = req.query.sortby;
      const limit = parseInt(req.query?.limit);
      if (sortBy) {
        sortObj[sortBy] = "desc";
      }
      const category = req.query?.category;
      if (category) {
        catObj.category = category;
      }
      const result = await courseColluction
        .find(catObj)
        .sort(sortObj)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseColluction.findOne(query);
      res.send(result);
    });

    app.get("/course-search", async (req, res) => {
      const search = req.query.search;
      const result = await courseColluction
        .find({ contestName: { $regex: ".*" + search + ".*", $options: "i" } })
        .toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const user = { email: userInfo?.email };
      const allUser = await userColluction.findOne(user);
      if (allUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userColluction.insertOne(userInfo);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userColluction.findOne(query);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userColluction.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello, I am future developer");
});

app.listen(port, () => {
  console.log(`coding contest listening on port ${port}`);
});
